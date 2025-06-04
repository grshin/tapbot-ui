import React, { useState } from 'react';
import TabLayout from './TabLayout';
import Home from './TabItem/Home';
import DeviceManager from './TabItem/DeviceManager';
import WorkManager from './TabItem/WorkManager';
import Setting from './TabItem/Setting';
import ControllerTCP from './TabItem/ControllerTCP';

import { TabType } from '../constants';

function Admin({ setCurrentMenu }) {
    //const [currentTab, setCurrentTab] = useState(TabType.HOME);
    const [currentTab, setCurrentTab] = useState(TabType.DEVICE_MANAGE);

    return (
        <TabLayout currentTab={currentTab} setCurrentTab={setCurrentTab} setCurrentMenu={setCurrentMenu}>
            {/* {currentTab === TabType.HOME && <Home />} */}
            {currentTab === TabType.DEVICE_MANAGE && <DeviceManager />}
            {currentTab === TabType.WORK_MANAGE && <WorkManager />}
            {currentTab === TabType.SETTING && <Setting />}
            {currentTab === TabType.CONTROLLER_TCP && <ControllerTCP />}
        </TabLayout>
    );
}
export default Admin;
