'''
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
'''

import time
import json
import socket

# 로봇 동작 관련 상수 (PC 테스트용 더미 값)
DR_AVOID = "DR_AVOID"                # Singular Handling Mode
DR_BASE = "DR_BASE"                  # 기준 좌표계
DR_WORLD = "DR_WORLD"
DR_MV_MOD_REL = "DR_MV_MOD_REL"      # 상대적 움직임 모드
DR_MV_MOD_ABS = "DR_MV_MOD_ABS"      # 절대적 움직임 모드
DR_MV_RA_DUPLICATE = "DR_MV_RA_DUPLICATE"  # 중복 반지름 모드
DR_MV_APP_NONE = "DR_MV_APP_NONE"    # 특별한 애플리케이션 없음
DR_AXIS_Z = "DR_AXIS_Z"              # Z축
DR_FC_MOD_REL = "DR_FC_MOD_REL"      # Force Control 상대 모드
DR_COND_NONE = "DR_COND_NONE"        # 조건 없음

ON = "ON"
OFF = "OFF"

# 환경 설정
IS_ROBOT_ENV = False  # True: 로봇 환경, False: PC 테스트 환경

g_fored_desired = 0
g_N = 10  # 분할 개수
g_accumulated_pos = [0, 0, 0]

# socket 통신 관련 전역 변수
g_server_sock = None  # 서버 소켓
g_client_sock = None  # 클라이언트 소켓
g_client_connected = False  # 클라이언트 연결 상태

def tp_log(*args):
    if IS_ROBOT_ENV:
        print(args)
    else:
        print("[PC_tp_log]", args)


# 로봇 및 더미 함수 정의
def wait(duration):
    time.sleep(duration)

def movel(position, time=None, ref=None, mod=None, radius=None, ra=None, app_type=None):
    print(f"[PC 더미] movel 호출: position={position}, ref={ref}, mod={mod}, radius={radius}, ra={ra}, app_type={app_type}")

def movej(position):
    print(f"[PC 더미] movej 호출: position={position}")

def posx(*position):
    return position if IS_ROBOT_ENV else f"PC_POSX({position})"

def posj(*angles):
    return angles if IS_ROBOT_ENV else f"PC_POSJ({angles})"

def task_compliance_ctrl():
    print("[PC 더미] Task Compliance Control 활성화")

def set_stiffnessx(stiffness, time=0.0):
    print(f"[PC 더미] 강성 설정: {stiffness}, 시간={time}")

def set_desired_force(force, direction, time=0.0, mod=None):
    global g_fored_desired, g_accumulated_pos
    g_fored_desired= force[2] # z 값에 대해서만 에뮬레이트
    g_accumulated_pos = [0, 0, 0]
    print(f"[PC 더미] 목표 힘 설정: 힘={force}, 방향={direction}, 시간={time}, 모드={mod}")

def release_force(time=0.0):
    global g_fored_desired
    g_fored_desired= 0
    print(f"[PC 더미] 힘 해제: 시간={time}")

def release_compliance_ctrl():
    print("[PC 더미] Compliance Control 해제")

def check_position_condition(axis, min, max, ref):
    print(f"[PC 더미] 위치 조건 확인: 축={axis}, 최소={min}, 최대={max}, 기준={ref}")
    return True  # PC 테스트 환경에서는 조건이 항상 참이라고 가정

def set_singular_handling(mode):
    print(f"[PC 더미] Singular Handling 설정: 모드={mode}")

def set_velj(velocity):
    print(f"[PC 더미] 조인트 속도 설정: 속도={velocity}")

def set_accj(acceleration):
    print(f"[PC 더미] 조인트 가속도 설정: 가속도={acceleration}")

def set_velx(velocity, angular_velocity):
    print(f"[PC 더미] 선형 속도 설정: 속도={velocity}, 각속도={angular_velocity}")

def set_accx(acceleration, angular_acceleration):
    print(f"[PC 더미] 선형 가속도 설정: 가속도={acceleration}, 각가속도={angular_acceleration}")

def server_socket_open(port):
    """ 서버 소켓을 생성하고, 클라이언트의 연결을 대기 """
    global g_server_sock, g_client_sock, g_client_connected

    # 기존 서버 소켓이 있다면 닫기
    if g_server_sock:
        server_socket_close(g_server_sock)

    try:
        # 서버 소켓 생성
        g_server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        g_server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        g_server_sock.bind(('0.0.0.0', port))
        g_server_sock.listen(1)

        print(f"[SERVER] 포트 {port}에서 클라이언트 대기 중...")
        g_client_sock, _ = g_server_sock.accept()  # 클라이언트 연결 대기
        g_client_connected = True
        print(f"[SERVER] 클라이언트 연결됨: {g_client_sock}")

        return g_client_sock  # 연결된 클라이언트 소켓 반환
    except Exception as e:
        print(f"[ERROR] 서버 소켓 생성 실패: {e}")
        return None


def server_socket_close(sock):
    """ 클라이언트와의 연결 종료 """
    global g_server_sock, g_client_sock, g_client_connected

    try:
        if g_client_sock:
            g_client_sock.close()
            g_client_sock = None
            g_client_connected = False
            print("[SERVER] 클라이언트 소켓 닫힘")

        if g_server_sock:
            g_server_sock.close()
            g_server_sock = None
            print("[SERVER] 서버 소켓 닫힘")
    except Exception as e:
        print(f"[ERROR] 소켓 종료 중 오류 발생: {e}")

def server_socket_read(sock, length=4096, timeout=5):
    """ 클라이언트로부터 데이터를 수신 """
    global g_client_connected

    if not sock:
        print("[ERROR] 읽을 소켓이 존재하지 않습니다.")
        return -1, None

    try:
        sock.settimeout(timeout)  # 타임아웃 설정 (기본 5초)
        data = sock.recv(length)  # 데이터 수신

        if not data:  # 클라이언트가 연결 종료한 경우
            print("[SERVER] 클라이언트 연결 종료 감지!")
            g_client_connected = False
            return -1, None

        return 1, data  # 정상 데이터 수신
    except socket.timeout:
        return 0, None  # 타임아웃 발생 (데이터 없음)
    except Exception as e:
        print(f"[ERROR] 데이터 수신 실패: {e}")
        g_client_connected = False
        return -1, None


def server_socket_write(sock, tx_data):
    """ 클라이언트에 데이터를 송신 """
    global g_client_connected

    if not sock or not g_client_connected:
        print("[ERROR] 송신할 클라이언트 소켓이 없습니다.")
        return -1

    try:
        sock.sendall(tx_data)  # 데이터 전송
        return 0  # 성공
    except (BrokenPipeError, ConnectionResetError, OSError):
        print("[SERVER] 클라이언트 연결이 끊어짐")
        g_client_connected = False
        return -1  # 클라이언트가 끊어짐

def is_socket_connected(sock):
    try:
        sock.getpeername()  # 클라이언트가 연결되어 있는지 확인
        return True
    except:
        return False

def  get_desired_posx(ref = DR_BASE):
    global g_fored_desired, g_accumulated_pos, g_N

    degree = g_fored_desired / g_N

    print(f"[PC 더미] get_desired_posx: {g_fored_desired}, {degree})")

    g_accumulated_pos[0] += degree
    g_accumulated_pos[1] += degree
    g_accumulated_pos[2] += degree

    '''
    if (g_fored_desired > 0 ):
        g_accumulated_pos[0] += degree
        g_accumulated_pos[1] += degree
        g_accumulated_pos[2] += degree
    else:
        g_accumulated_pos[0] -= degree
        g_accumulated_pos[1] -= degree
        g_accumulated_pos[2] -= degree
    '''

    print("[PC 더미] get_desired_posx", g_accumulated_pos, g_fored_desired)
    return g_accumulated_pos


def set_digital_output(index, val=None):
    if IS_ROBOT_ENV:
        print("[set_digital_output]")
    else:
        print("[PC 더미] set_digital_output", index, val)
        return 0

def set_ref_coord(coord):
    print("[set_ref_coord]", coord)
    return 0

def get_force_control_state():
    print("[get_force_control_state]")

    singularity = 0
    mod = 0
    stx = 0
    fd = 0
    ref = 0
    return singularity, mod, stx, fd, ref

def get_tool_force(ref):
    print("[get_tool_force]", ref)
    wait(0.5)
    force = [20,20,20,20,20,20]
    print(f"[PC 더미] get_tool_force: force[2]={force[2]}")
    return force    

def start_timer():
    print("[start_timer]")
    return 0

def end_timer():
    print("[end_timer]")
    return 200