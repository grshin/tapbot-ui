from robot_helpers import (
    DR_AVOID,
    DR_BASE,
    DR_WORLD,
    DR_MV_MOD_REL,
    DR_MV_MOD_ABS,
    DR_MV_RA_DUPLICATE,
    DR_MV_APP_NONE,
    DR_AXIS_Z,
    DR_FC_MOD_REL,
    DR_COND_NONE,
    ON,
    OFF,
    tp_log,
    wait,
    movel,
    movej,
    posx,
    posj,
    task_compliance_ctrl,
    set_stiffnessx,
    set_desired_force,
    release_force,
    release_compliance_ctrl,
    check_position_condition,
    server_socket_open,
    server_socket_close,
    server_socket_read,
    server_socket_write,
    set_singular_handling,
    set_velj,
    set_accj,
    set_velx,
    set_accx,
    get_desired_posx,
    set_digital_output,
    set_ref_coord,
    get_force_control_state,
    get_tool_force,
    start_timer,
    end_timer
)

import math
import time
import json
import sys

g_jhome = posj(0.00, 0.00, 90.00, 0.00, 90.00, 0.00)

TCP_PORT = 5033
g_sock = 0
g_client_connected = False

dio_high_on_mode = True

g_motor_mode = 'operation-on'
g_motor_action = ''

tapping_start_pos = 0
tapping_end_pos = 0

# 모재 시작 위치 측정
workpiece_surface_pos = posx(0.000, 0.000, -35.000, 0.00, 180.00, 0.00)
workpiece_check_pos = [60, 200] # ref 원점에서 측정하는 것을 기본으로 설정
reachArea = [480, 480]

EPSILON = 0.1  # 허용 오차 값 추가
DIO_EPSILON = 0.025
MOMENT = 0.01

# g_jhome에서 시작해서 아래 점으로 movel
g_ref = 104 # UC_DS2 - ref_104 (240.420, -247.750, 179.0, 0.00, 0.00, 0.00) # 대일 원점 (4/14)
#                               465.00, -247.20, 160.0
#                               464.70, 276.50,  160.0

g_rpmIndex = 11

g_tapbot_off = False

# 목표 좌표계 설정: 'ZYZ' 또는 'XYZ'
target_coordinate_system = 'ZYZ'

def zyz_to_xyz(alpha, beta, gamma):
    """ZYZ 오일러 각을 XYZ 오일러 각으로 변환 (간략화된 방식)"""
    
    # 변환된 XYZ 오일러 각 계산
    phi = gamma  # Z축 회전
    theta = beta  # Y축 회전
    psi = alpha - gamma  # X축 회전 변환

    # 소수점 6자리까지 반올림
    return round(phi, 6), round(theta, 6), round(psi, 6)

def convert_posx(x, y, z, a, b, c):
    if target_coordinate_system == 'XYZ':
        phi, theta, psi = zyz_to_xyz(a, b, c)
        converted = [x, y, z, phi, theta, psi]
    else:
        converted = [x, y, z, a, b, c]

    ## logToServer("convert_posx :", converted)  # 최종 변환된 값 출력
    return converted

def logToServer(text = "", data = "", type = "DEBUG"):
    global DIO_EPSILON, g_client_connected, g_sock

    debut_text = {"type":type, "text": text, "data": data}
    json_text = json.dumps(debut_text, ensure_ascii=False) + '\r\n'# 전송용 문자열: JSON + 줄바꿈 (\r\n)

    #print(f"[logToServer] g_client_connected: {g_client_connected}, g_sock: {g_sock})")

    if g_client_connected:
        server_socket_write(g_sock, json_text.encode('utf-8'))
    else:
        tp_log(text)

    wait(DIO_EPSILON)

    return 0

def responceViaTCP(response_data):
    global g_client_connected
    global g_sock
    global DIO_EPSILON

    '''
    response_data = {
        "type": "tapping",
        "payload": {
            "status": "completed",  # 작업 완료 상태
            "executionTime": 3,     # 실행 시간(예제)
            "message": "Tapping 작업이 완료되었습니다!"
        }
    }
    '''

    json_text = json.dumps(response_data, ensure_ascii=False)
    text_with_newline = json_text + '\r\n'

    if g_client_connected and g_sock:
        server_socket_write(g_sock, text_with_newline.encode('utf-8'))
    else:
        tp_log(text)

    wait(DIO_EPSILON)

    return 0

# 초기에 위로 올라가느 동작 수행.
def init_pos_up(target_pos, time = 1.0, ref = DR_BASE):
    #logToServer("#### init_pos_up:ref ", ref)
    tap_up = posx(0, 0, target_pos, 0.00, 0.00, 0.00)
    movel(tap_up, ref=ref, mod=DR_MV_MOD_REL, time=time)
    return 0

def checking_tap():
    global g_ref
    global initialHeight

    ## logToServer("#### checking_tap...")
    #dir = initialHeight - 4
    dir = 10

    movel(posx(0.00, 0.00, -dir, 0.00, 0.00, 0.00), radius=0.00, ref=g_ref, mod=DR_MV_MOD_REL, ra=DR_MV_RA_DUPLICATE, app_type=DR_MV_APP_NONE, time=0)
    movel(posx(0.00, 0.00, dir, 0.00, 0.00, 0.00), radius=0.00, ref=g_ref, mod=DR_MV_MOD_REL, ra=DR_MV_RA_DUPLICATE, app_type=DR_MV_APP_NONE, time=0)

    return 0

def checking_tap_with_compliance(depth = 3.0, force = 30):
    return 0

def check_reach(reach_x = 470, reach_y = 470, force = 60):

    logToServer("#### check_reach:force ", force)
    global g_ref

    # UC_tapbot [ref_10x]: 작업대 원점 적용
    origin = convert_posx(0.00, 0.00, 0.00, 0.00, 180.00, 0.00)
    tap_pos1 = convert_posx(0, 0, 0, 0.00, 180.00, 0.00)
    tap_pos2 = convert_posx(reach_x, 0, 0, 0.00, 180.00, 0.00)
    tap_pos3_1 = convert_posx(reach_x, reach_y/2, 0, 0.00, 180.00, 0.00)
    tap_pos3_2 = convert_posx(reach_x, reach_y, 0, 0.00, 180.00, 0.00)
    tap_pos4_1 = convert_posx(0, reach_y/2, 0, 0.00, 180.00, 0.00)
    tap_pos4_2 = convert_posx(0, reach_y, 0, 0.00, 180.00, 0.00)

    movel(origin, radius=0.00, ref=g_ref, mod=DR_MV_MOD_ABS, ra=DR_MV_RA_DUPLICATE, app_type=DR_MV_APP_NONE)
    #checking_tap_with_compliance(10.0, force)
    checking_tap()

    movel(tap_pos2, ref=g_ref, mod=DR_MV_MOD_ABS)
    #checking_tap_with_compliance(10.0, force)
    checking_tap()

    movel(tap_pos3_1, ref=g_ref, mod=DR_MV_MOD_ABS)
    #checking_tap_with_compliance(10.0, force)
    checking_tap()
    movel(tap_pos3_2, ref=g_ref, mod=DR_MV_MOD_ABS)
    #checking_tap_with_compliance(10.0, force)
    checking_tap()

    movel(tap_pos4_2, ref=g_ref, mod=DR_MV_MOD_ABS)
    #checking_tap_with_compliance(10.0, force)
    checking_tap()

    movel(tap_pos2, ref=g_ref, mod=DR_MV_MOD_ABS)
    #checking_tap_with_compliance(10.0, force)
    checking_tap()

    movel(tap_pos3_2, ref=g_ref, mod=DR_MV_MOD_ABS)
    #checking_tap_with_compliance(10.0, force)
    checking_tap()

    movel(origin, radius=0.00, ref=g_ref, mod=DR_MV_MOD_ABS, ra=DR_MV_RA_DUPLICATE, app_type=DR_MV_APP_NONE)
    #checking_tap_with_compliance(10.0, force)
    checking_tap()

    movel(tap_pos4_1, ref=g_ref, mod=DR_MV_MOD_ABS)
    #checking_tap_with_compliance(10.0, force)
    checking_tap()
    movel(tap_pos4_2, ref=g_ref, mod=DR_MV_MOD_ABS)
    #checking_tap_with_compliance(10.0, force)
    checking_tap()

    movej(g_jhome)

    return 0

# UC 기준 [x,y] 위치에서 가공물 surface 위치 측정 - z값 사용을 목적으로 함
def check_workpiece_surface(x, y):
# 체크 시작점으로 이동 -> 사용자 좌표계 원점으로 이동처리 (25/03/20)
    global workpiece_surface_pos
    global workpiece_check_pos
    global g_ref

    logToServer("#### check_workpiece_surface...")

    workpiece_surface_pos = get_desired_posx(ref=g_ref)
    movel(convert_posx(0.00, 0.00, 20.00, 0.00, 0.00, 0.00), time =1.5, radius=0.00, ref=g_ref, mod=DR_MV_MOD_REL, ra=DR_MV_RA_DUPLICATE, app_type=DR_MV_APP_NONE)        
    return 0

def tapping_once_compliance_on(x, y, tool, tapInfo, mode=""):
    global workpiece_surface_pos
    global tapping_start_pos
    global tapping_end_pos

    global tapSize
    global partThickness
    global chamferLength
    global machiningAllowance
    global initialHeight
    global g_ref
    global g_rpmIndex

    # logToServer("#### tapping_once_compliance_on", tapInfo)

    # workDetail:Play에서 전달되는 값으로 설정
    tapSize = tapInfo['tapSize']
    initialHeight = float(tapInfo['initialHeight'])
    partThickness = float(tapInfo['partThickness'])
    chamferLength = float(tapInfo['chamferLength'])
    machiningAllowance = float(tapInfo['machiningAllowance'])

    # 시작위치 지정: 순응 제어로 측정된 모재의 높이 + initialHeight
    tapping_start_pos = workpiece_surface_pos[2] + initialHeight # z- 방향으로 탭핑, 안전마진 만큼 높여줌!!, 5.0mm 높은 지점에서 시작
    #logToServer(">>  workpiece_surface_pos", workpiece_surface_pos)
    #logToServer(">> tapping_start_pos", tapping_start_pos)

    # 탭핑 시작 위치로 이동
    set_ref_coord(g_ref)
    pos = convert_posx(x,y,tapping_start_pos, 0.00, 180.00, 0.00)
    #movel(pos, radius=0.00, ref=g_ref, mod=DR_MV_MOD_ABS)
    movel(pos, radius=0.00, ref=g_ref, mod=DR_MV_MOD_ABS, ra=DR_MV_RA_DUPLICATE, app_type=DR_MV_APP_NONE)

    if mode == 'continued_compliance_ctrl':
        tapping_down(mode)
        set_airInjector('on')
        tapping_up(mode)
    else:
        tapping_down()
        set_airInjector('on')
        tapping_up()

    set_airInjector('off')
    
    return 0

def preview_position(x, y, tool, tapInfo):
    global workpiece_surface_pos
    global tapping_start_pos
    global tapping_end_pos

    global tapSize
    global partThickness
    global chamferLength
    global machiningAllowance
    global initialHeight
    global g_ref

    #logToServer("#### check_position", tapInfo)

    # workDetail:Play에서 전달되는 값으로 설정
    tapSize = tapInfo['tapSize']
    initialHeight = float(tapInfo['initialHeight'])
    partThickness = float(tapInfo['partThickness'])
    chamferLength = float(tapInfo['chamferLength'])
    machiningAllowance = float(tapInfo['machiningAllowance'])

    # 시작위치 지정: 순응 제어로 측정된 모재의 높이 + initialHeight
    tapping_start_pos = workpiece_surface_pos[2] + initialHeight # z- 방향으로 탭핑, 안전마진 만큼 높여줌!!, 5.0mm 높은 지점에서 시작
    #logToServer(">>  workpiece_surface_pos", workpiece_surface_pos)
    #logToServer(">> tapping_start_pos", tapping_start_pos)

    # 탭핑 시작 위치로 이동
    pos = convert_posx(x,y,tapping_start_pos, 0.00, 180.00, 0.00)
    movel(pos, radius=0.00, ref=g_ref, mod=DR_MV_MOD_ABS, ra=DR_MV_RA_DUPLICATE, app_type=DR_MV_APP_NONE)

    #checking_tap_with_compliance(2.0)
    checking_tap()
   
    return 0    

def tapping_down(mode = ""):
    return 0

def tapping_up(mode = ""):
    return 0

def motor_cw():
    global g_motor_action
    global g_motor_mode
    ##logToServer('motor_cw ', g_motor_mode)

    if g_motor_mode != 'operation-on':
        logToServer('motor_cw 실행 안 함: 모터 모드가 OFF 상태임')
        return
    
    g_motor_action = 'motor_cw'

    #logToServer('모터 정방향 ON (디지털 출력 설정 시작)')
    
    if dio_high_on_mode:
        set_digital_output(7, OFF)
        set_digital_output(6, ON)# cw: sig_6
        ##logToServer('디지털 출력 설정 완료: 7=OFF, 6=ON')
    else:
        set_digital_output(7, ON)
        set_digital_output(6, OFF)# cw: sig_6
        ##logToServer('디지털 출력 설정 완료: 7=ON, 6=OFF')
    
    # wait(0.25)
    return 0 
    
def motor_ccw():
    global g_motor_action
    global g_motor_mode
    ##logToServer('motor_ccw', g_motor_mode)

    if g_motor_mode != 'operation-on':
        logToServer('motor_ccw 실행 안 함: 모터 모드가 OFF 상태임')
        return

    g_motor_action = 'motor_ccw'

    #logToServer('모터 역방향 ON (디지털 출력 설정 시작)')

    if dio_high_on_mode:
        set_digital_output(6,OFF)
        set_digital_output(7,ON)# ccw: sig_7
        ##logToServer('디지털 출력 설정 완료: 6=OFF 7=ON')
    else:
        set_digital_output(6,ON)
        set_digital_output(7,OFF)# ccw: sig_7
        ##logToServer('디지털 출력 설정 완료: 6=ON, 7=OFF')
    
    # wait(0.25)
    return 0
    
def motor_stop():
    global g_motor_action
    if dio_high_on_mode:
        set_digital_output(6,OFF)
        set_digital_output(7,OFF)
        ##logToServer('디지털 출력 설정 완료: 6=OFF, 7=OFF')
    else:
        set_digital_output(6,ON)
        set_digital_output(7,ON)
        ##logToServer('디지털 출력 설정 완료: 6=ON, 7=ON')

    g_motor_action = 'motor_stop'
    #wait(0.25)

    return 0

# cw 상황에서 power stop 하는 기능
def motor_cw_power_stop():
    global DIO_EPSILON

    motor_stop()
    motor_ccw()
    wait(DIO_EPSILON) ## 시간 확정 필요
    motor_stop()
    return 0

# ccw 상황에서 power stop 하는 기능
def motor_ccw_power_stop():
    global DIO_EPSILON

    motor_stop()
    motor_cw()
    wait(DIO_EPSILON) ## 시간 확정 필요
    motor_stop()
    return 0

def set_rpm(rpm):
    logToServer("set_rpm", rpm)
    return 0

def set_motor_mode(mode, value):
    global g_motor_mode

    if mode == 'soft_start':
        if value == 100:
            set_digital_output(1, ON) # 100ms
        elif value == 500:
            set_digital_output(1, OFF) # 500ms
        wait (DIO_EPSILON)
    elif mode == 'operation':
        if value == 'on':
            g_motor_mode = 'operation-on'
        elif value == 'off':
            g_motor_mode = 'operation-off'

    logToServer("g_motor_mode: ", g_motor_mode)
    return 0

def set_rpm_index_16(rpmIndex, high_on_mode=True):
    global DIO_EPSILON

    #newRpmIndex = int(rpmIndex)  # 문자열 -> 정수 변환
    newRpmIndex = rpmIndex
    # # 0~15단계로 비트 연산 가능하도록 수정
    newRpmIndex = newRpmIndex -1
    # # 최고 15 단계만 설정할 수 있도록 조정
    # if newRpmIndex == 15:
    #     newRpmIndex = 14
    
    # 16단계를 4개의 DIO 비트로 변환 (2진수)
    binary_value = format(newRpmIndex, '04b')  # 4비트 문자열 변환

    # high_on_mode 설정에 따라 ON/OFF 변환
    dio_states = [
        ON if (bit == '1') == high_on_mode else OFF
        for bit in binary_value
    ]

    # DIO 설정 적용 - 0001
    set_digital_output(2, dio_states[0])    # 0
    set_digital_output(3, dio_states[1])    # 0
    set_digital_output(4, dio_states[2])    # 0
    set_digital_output(5, dio_states[3])    # 1

    logToServer("RPM 단계: ", rpmIndex)
    logToServer("DIO 상태: ", dio_states)

    wait(DIO_EPSILON)
    return 0

def motor_action(action):
    global g_motor_action
    logToServer("motor_action", action)

    if action == 'motor_cw':
        motor_cw()
    elif action == 'motor_ccw':
        motor_ccw()
    elif action == 'stop':
        if g_motor_action == 'motor_cw':
            motor_cw_power_stop()
        elif g_motor_action == 'motor_ccw':
            motor_ccw_power_stop()

    return 0

def set_motor(motor_data):
    mode = motor_data.get('mode', 'N/A')
    rpmIndex = motor_data.get('rpmIndex', 'N/A')
    action = motor_data.get('action', 'N/A')
    value = motor_data.get('value', 'N/A')

    if rpmIndex != 'N/A':
        set_rpm_index_16(rpmIndex, True)
    if mode != 'N/A':
        set_motor_mode(mode, value)
    if action != 'N/A':
        motor_action(action)

    return 0

def set_workPiece(workpiece_data):
    global workpiece_check_pos, g_ref

    mode = workpiece_data.get('mode', 'N/A')# 'check', 'goto_ref_origin'
    workpiece_check_pos[0] = float(workpiece_data.get('x', 0))
    workpiece_check_pos[1] = float(workpiece_data.get('y', 0))

    if mode == 'check':
        check_workpiece_surface(workpiece_check_pos[0], workpiece_check_pos[1])
    elif mode == 'goto_ref_origin':# user_coordinates 원점으로 이동
        movel(convert_posx(0.00, 0.00, 0.00, 0.00, 180.00, 0.00), radius=0.00, ref=g_ref, mod=DR_MV_MOD_ABS, ra=DR_MV_RA_DUPLICATE, app_type=DR_MV_APP_NONE)

    executionTime = end_timer()
    response_data = {
        "type": 'workPiece',
        "payload": {
            "status": "completed",              # 작업 완료 상태
            "executionTime": executionTime,    # 실행 시간(예제)
            "message": "workPiece 측정 작업이 완료되었습니다!"
        }
    }

    responceViaTCP(response_data)

    return 0

def check_reachArea(reachArea_data):

    logToServer("#### check_reachArea...")

    mode = reachArea_data.get('mode', 'N/A')# 'check', goto_ref_origin
    x = float(reachArea_data.get('x', 0))
    y = float(reachArea_data.get('y', 0))

    if mode == 'check':
        check_reach(x, y, 50)
    elif mode == 'goto_ref_origin':
        movel(convert_posx(0.00, 0.00, 0.00, 0.00, 180.00, 0.00), radius=0.00, ref=g_ref, mod=DR_MV_MOD_ABS, ra=DR_MV_RA_DUPLICATE, app_type=DR_MV_APP_NONE)

    executionTime = end_timer()
    response_data = {
        "type": 'reachArea',
        "payload": {
            "status": "completed",              # 작업 완료 상태
            "executionTime": executionTime,    # 실행 시간(예제)
            "message": "maintenancePosture 작업이 완료되었습니다!"
        }
    }

    responceViaTCP(response_data)    

    return 0

def set_tapbotStatus(mode):
    global g_tapbot_off
    if mode == 'off':
        g_tapbot_off = True
    else:
        g_tapbot_off = False

def set_coolingFan(state):
    global DIO_EPSILON

    cooling_fan = state

    # sig_10
    if cooling_fan == 'on':
        set_digital_output(10,ON)
    elif cooling_fan == 'off':
        set_digital_output(10,OFF)

    wait(DIO_EPSILON)
    #logToServer("set_coolingFan", cooling_fan)
    return 0

def set_airInjector(state):
    global DIO_EPSILON

    air_injector = state

    # sig_8
    if air_injector == 'on':
        set_digital_output(9,OFF) # oil_off
        set_digital_output(8,ON)  # air_on
    elif air_injector == 'off':
        set_digital_output(9,OFF) # oil_off
        set_digital_output(8,OFF) # air_off

    wait(DIO_EPSILON)
    ## logToServer("set_airInjector", air_injector)
    return 0

def set_oilInjector(state):
    global DIO_EPSILON

    oil_injector = state

    # sig_9
    if oil_injector == 'on':
        set_digital_output(8,OFF) # air_off
        set_digital_output(9,ON)  # oil_on
    elif oil_injector == 'off':
        set_digital_output(8,OFF) # air_off
        set_digital_output(9,OFF) # oil_off

    wait(DIO_EPSILON)
    ## logToServer("set_oilInjector", oil_injector)
    return 0

def set_maintenancePosture(param):
    if param == 'on':
        maintenancePosture = posj(-90.00, 0.00, 90.00, 0.00, 0.00, 0.00)
        movej(maintenancePosture)
        logToServer("set_maintenanceFunction", maintenancePosture)
    elif param == 'off':
        movej(g_jhome)
    
    executionTime = end_timer()
    response_data = {
        "type": 'maintenancePosture',
        "payload": {
            "status": "completed",              # 작업 완료 상태
            "executionTime": executionTime,    # 실행 시간(예제)
            "message": "maintenancePosture 작업이 완료되었습니다!"
        }
    }

    responceViaTCP(response_data)    
    return 0

def process_command_data(payload):
    # logToServer("process_command_data...")

    if "motor" in payload:
        set_motor(payload["motor"])
    if "coolingFan" in payload:
        set_coolingFan(payload["coolingFan"])
    if "airInjector" in payload:
        set_airInjector(payload["airInjector"])
        
    if "oilInjector" in payload:
        set_oilInjector(payload["oilInjector"])
    
        try:
            oilDuration = int(payload["oilDuration"]) / 1000
        except (ValueError, TypeError):
            oilDuration = 0.025  # 변환 실패 시 기본값
    
        if oilDuration != 0.025:
            wait(oilDuration)
            set_oilInjector('off')

    if "workPiece" in payload:
        set_workPiece(payload["workPiece"])
    if "maintenancePosture" in payload:
        set_maintenancePosture(payload["maintenancePosture"])
    if "reachArea" in payload:
        check_reachArea(payload["reachArea"])
    if "tapbotStatus" in payload:
        set_tapbotStatus(payload["tapbotStatus"])

    return 0

def process_settings_data(payload):
    logToServer("[Settings Data]")
    for key, value in payload.items():
        logToServer("process_settings_data key, ", key)
        logToServer("process_settings_data value, ", value)

    return 0

def convert_payload_to_dicts(payload):
    #work = payload['work']
    taps = payload['taps']
    tapInfo = payload['tapInfo']
    #return work, taps, tapInfo
    return tapInfo, taps

def process_work_and_taps(payload, data_type = ""):
    preview_pos_count = 0
    global g_ref
    global g_rpmIndex

    #work, taps, tapInfo = convert_payload_to_dicts(payload)
    tapInfo, taps = convert_payload_to_dicts(payload)

    logToServer("process_work_and_taps")
    logToServer(">> data_type ", data_type)
    logToServer(">> taps ", taps)
    logToServer(">> tapInfo ", tapInfo)

    g_rpmIndex = int(tapInfo['rpmIndex'])
    set_rpm_index_16(g_rpmIndex, True)
    logToServer(">> g_rpmIndex ", g_rpmIndex)

    checkWorkpiece = tapInfo['checkWorkpiece']

    set_coolingFan('off')

    # user_coordinates로 이동
    movel(convert_posx(0.00, 0.00, 0.00, 0.00, 180.00, 0.00), radius=0.00, ref=g_ref, mod=DR_MV_MOD_ABS, ra=DR_MV_RA_DUPLICATE, app_type=DR_MV_APP_NONE)    

    # 가공물 시작 위치 측정
    if checkWorkpiece == 'on':
        check_workpiece_surface(workpiece_check_pos[0], workpiece_check_pos[1])

    for i in range(1):
        for tap in taps:
            x = tap['x']
            y = tap['y']
            tool = tap['t']
            
            if data_type == "tapping":
                tapping_once_compliance_on(x, y, tool, tapInfo)
            elif data_type == "previewPosition":
                preview_position(x, y, tool, tapInfo)
                preview_pos_count = preview_pos_count + 1
            '''
            if( preview_pos_count == 15 ):
                break
            '''
            wait(0.001)

        movej(g_jhome)

    executionTime = end_timer()
    movej(g_jhome)
    process_tapping_finish(data_type, executionTime)

    return 0

def process_tapping_finish(data_type, executionTime):

    response_data = []
    if data_type == "tapping":
        response_data = {
            "type": data_type,
            "payload": {
                "status": "completed",          # 작업 완료 상태
                "executionTime": executionTime,    # 실행 시간(예제)
                "message": "Tapping 작업이 완료되었습니다!"
            }
        }
    elif data_type == "previewPosition":
        response_data = {
            "type": data_type,
            "payload": {
                "status": "completed",          # 작업 완료 상태
                "executionTime": executionTime,    # 실행 시간(예제)
                "message": "위치확인(로봇) 작업이 완료되었습니다!"
            }
        }

    responceViaTCP(response_data)
   
    set_airInjector('off')
    blinkCoolingFan(1)
    
    logToServer("탭핑 작업이 완료되었습니다. ")

    return 0

def blinkCoolingFan(iteration, time = 0.25):
    for i in range(iteration):
        set_coolingFan('on')
        wait(time)
        set_coolingFan('off')

    return 0

def init_dio():
    # digital signal off from DIO_1 ~ DIO_10
    set_digital_output(1,OFF)# soft start 100ms
    set_digital_output(2,OFF)
    set_digital_output(3,OFF)
    set_digital_output(4,OFF)
    set_digital_output(5,OFF)
    set_digital_output(6,OFF)
    set_digital_output(7,OFF)
    set_digital_output(8,OFF)
    set_digital_output(9,OFF)
    set_digital_output(10,OFF)

    return 0

def init_socket():
    global g_sock, g_client_connected, TCP_PORT
    logToServer("[INIT] init_socket() 호출됨")

    if g_sock:
        logToServer("[INIT] 기존 소켓 닫기 시작")
        server_socket_close(g_sock)
        logToServer("[INIT] 기존 소켓 닫기 완료")

    g_sock = 0
    g_client_connected = False
    wait(0.25)

    g_sock = server_socket_open(TCP_PORT)
    if g_sock:
        logToServer("[INIT] 새 소켓 생성 완료:  {0} ".format(g_sock))
        g_client_connected = True
    else:
        logToServer("[INIT] 새 소켓 생성 실패!")
        g_client_connected = False

    wait(0.25)
    return 0

def init_robot():
    set_singular_handling(DR_AVOID)
    set_velj(60.0)
    set_accj(100.0)

    set_velx(2000.0, 200)
    set_accx(2000.0, 300)
    
    init_dio()
    init_pos_up(50, 0.5, DR_BASE)
    set_coolingFan('on')

    movej(g_jhome)
    return 0

def receive_complete_data(sock, length=4096):
    """소켓에서 데이터를 조각 단위로 읽어 완전한 JSON 메시지를 조립"""
    buffer_size = 4096  # 한 번에 받을 데이터 크기
    data_buffer = b''   # 수신된 데이터 저장 버퍼

    while True:
        res, chunk = server_socket_read(sock, length=buffer_size)
        
        if res == -1:  # 소켓이 닫힌 경우
            logToServer("[ERROR] 클라이언트 연결이 종료됨")
            return res, None  
        
        if chunk:
            data_buffer += chunk  # 버퍼에 추가

            try:
                decoded_data = data_buffer.decode('utf-8', errors='ignore')  # 디코딩
                json_data = json.loads(decoded_data)  # JSON 변환 시도
                return res, json_data  # JSON 데이터가 완전하게 수신됨
            except Exception:
                logToServer("[INFO] 데이터가 아직 불완전함. 추가 데이터 수신 대기...")
                continue  # JSON 파싱이 실패하면 계속 데이터 수신

    return res, None  # 정상적인 JSON 데이터를 받지 못한 경우

########################################
### Main Logics
g_sock = 0

init_robot()
init_socket()

def main():
    global g_sock

    while True:
        
        res, json_data = receive_complete_data(g_sock, length=4096)
        logToServer("[SERVER] json_data", json_data)
        set_coolingFan('on')

        if res == -1:
            logToServer("[SERVER] 클라이언트 접속이 종료됨! 소켓을 다시 초기화합니다.")
            init_socket()  # 클라이언트가 끊어지면 소켓을 재설정
            continue


        if json_data is None:
            logToServer("[ERROR] 수신된 데이터가 None입니다.")
            continue  # None이면 다음 반복으로 넘어감

        if json_data:
            # json_data = data.decode('utf-8')
            # parsed_data = json.loads(json_data)
            logToServer("json 데이터::", json_data)

            data_type = json_data.get("type", None)
            payload = json_data.get("payload", {})
            # logToServer("data_type: ", data_type)
            # logToServer("payload: ", payload)

            if data_type is None:
                logToServer("[ERROR] 데이터 타입(type)이 없습니다.")
                continue

            executionTime = 0
            start_timer()

            if data_type == "command":
                process_command_data(payload)
            elif data_type == "settings":
                process_settings_data(payload)
            elif data_type == 'tapping':
                process_work_and_taps(payload, data_type)
            elif data_type == 'previewPosition':
                process_work_and_taps(payload, data_type)
            else:
                logToServer("알 수 없는 데이터 타입입니다.")
        if g_tapbot_off == True:
            logToServer("TapBot을 종료합니다!!")
            break

if __name__ == "__main__":
    main()

    server_socket_close(g_sock)  # 소켓 닫기
    sys.exit(0)  # 명시적으로 프로세스 종료
