import * as React from 'react';

const DEVICE_STORAGE_KEY = 'openglassDeviceId';

export function useDevice(): [BluetoothRemoteGATTServer | null, () => Promise<void>, boolean] {

    // Create state
    let deviceRef = React.useRef<BluetoothRemoteGATTServer | null>(null);
    let [device, setDevice] = React.useState<BluetoothRemoteGATTServer | null>(null);
    let [isAutoConnecting, setIsAutoConnecting] = React.useState<boolean>(false);

    // Setup disconnect handler
    const setupDisconnectHandler = (connectedDevice: BluetoothDevice) => {
        connectedDevice.ongattserverdisconnected = async () => {
            console.log('Device disconnected');
            deviceRef.current = null;
            setDevice(null);
            setIsAutoConnecting(false);

            // Don't auto-reconnect - let user manually reconnect
            // This prevents disconnect loops
        };
    };

    // Create callback
    const doConnect = React.useCallback(async () => {
        try {
            // Connect to device
            console.log('Requesting device connection...');
            let connected = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'OMI Glass' }],
                optionalServices: [
                    '19b10000-e8f2-537e-4f6c-d104768a1214', // OMI service
                    '0000180a-0000-1000-8000-00805f9b34fb', // Device information service
                    '0000180f-0000-1000-8000-00805f9b34fb', // Battery service
                ],
            });

            // Store device ID for future reconnections
            console.log('Storing device ID:', connected.id);
            localStorage.setItem(DEVICE_STORAGE_KEY, connected.id);

            // Connect to gatt with timeout and retry logic
            console.log('Connecting to GATT server...');

            let gatt: BluetoothRemoteGATTServer | null = null;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts && !gatt) {
                try {
                    attempts++;
                    console.log(`Connection attempt ${attempts}/${maxAttempts}...`);

                    // Try to connect with a timeout
                    const connectPromise = connected.gatt!.connect();
                    const timeoutPromise = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Connection timeout')), 5000)
                    );

                    gatt = await Promise.race([connectPromise, timeoutPromise]);

                    // Verify connection
                    if (gatt && gatt.connected) {
                        console.log('Connected successfully!');
                        break;
                    } else {
                        console.warn('Connection returned but not connected, retrying...');
                        gatt = null;
                    }
                } catch (error) {
                    console.warn(`Attempt ${attempts} failed:`, error);
                    if (attempts >= maxAttempts) {
                        throw new Error(`Failed to connect after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`);
                    }
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (!gatt || !gatt.connected) {
                throw new Error('Failed to establish GATT connection');
            }

            console.log('GATT connection established:', gatt.connected);

            // Update state
            deviceRef.current = gatt;
            setDevice(gatt);

            // Setup disconnect handler for auto-reconnect
            setupDisconnectHandler(connected);

        } catch (e) {
            // Handle error
            console.error('Connection failed:', e);
            alert(`Connection failed: ${e instanceof Error ? e.message : String(e)}\n\nPlease try again.`);
        }
    }, []);

    // Return
    return [device, doConnect, isAutoConnecting];
}
