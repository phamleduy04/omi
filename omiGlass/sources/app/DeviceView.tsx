import * as React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { rotateImage } from '../modules/imaging';
import { toBase64Image } from '../utils/base64';
import { Agent } from '../agent/Agent';
import { InvalidateSync } from '../utils/invalidateSync';
import { textToSpeech } from '../modules/openai';
import { sendPhotoWebhook, sendAudioWebhook, getWebhookConfig } from '../utils/webhooks';

function usePhotos(device: BluetoothRemoteGATTServer) {

    // Subscribe to device
    const [photos, setPhotos] = React.useState<Array<{ data: Uint8Array; timestamp: number }>>([]);
    const [subscribed, setSubscribed] = React.useState<boolean>(false);
    React.useEffect(() => {
        (async () => {
            // Wait for connection to stabilize
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check if still connected
            if (!device.connected) {
                console.error('Device disconnected before setup could complete');
                return;
            }

            // Get firmware version
            let firmwareVersion = '2.1.1'; // Default to new version
            try {
                if (device.connected) {
                    const deviceInfoService = await device.getPrimaryService('device_information');
                    const firmwareChar = await deviceInfoService.getCharacteristic('firmware_revision_string');
                    const firmwareValue = await firmwareChar.readValue();
                    firmwareVersion = new TextDecoder().decode(firmwareValue);
                    console.log('Firmware version:', firmwareVersion);
                }
            } catch (e) {
                console.log('Could not read firmware version, assuming 2.1.1+');
            }

            // Check connection again before continuing
            if (!device.connected) {
                console.error('Device disconnected during firmware check');
                return;
            }

            function compareVersions(v1: string, v2: string): number {
                const parts1 = v1.split('.').map(Number);
                const parts2 = v2.split('.').map(Number);
                const len = Math.max(parts1.length, parts2.length);
                for (let i = 0; i < len; i++) {
                    const p1 = parts1[i] || 0;
                    const p2 = parts2[i] || 0;
                    if (p1 > p2) return 1;
                    if (p1 < p2) return -1;
                }
                return 0;
            }

            const newRotationLogic = compareVersions(firmwareVersion, '2.1.1') >= 0;

            let previousChunk = -1;
            let buffer: Uint8Array = new Uint8Array(0);
            let orientation: number = 0;
            function onChunk(id: number | null, data: Uint8Array) {

                // Resolve if packet is the first one
                if (previousChunk === -1) {
                    if (id === null) {
                        return;
                    } else if (id === 0) {
                        previousChunk = 0;
                        buffer = new Uint8Array(0);
                        if (newRotationLogic) {
                            orientation = data[0];
                            data = data.slice(1);
                        }
                    } else {
                        return;
                    }
                } else {
                    if (id === null) {
                        console.log('Photo received', buffer);
                        const timestamp = Date.now(); // Get current timestamp
                        let rotation: '0' | '90' | '180' | '270' = '180';
                        if (newRotationLogic) {
                            rotation = '0';
                            if (orientation === 1) {
                                rotation = '90';
                            } else if (orientation === 2) {
                                rotation = '180';
                            } else if (orientation === 3) {
                                rotation = '270';
                            }
                        }
                        rotateImage(buffer, rotation).then((rotated) => {
                            console.log('Rotated photo', rotated);
                            setPhotos([{ data: rotated, timestamp: timestamp }]); // Only keep latest photo for video-like view

                            // Send to webhook if enabled
                            const webhookConfig = getWebhookConfig();
                            if (webhookConfig.photoEnabled && webhookConfig.photoUrl) {
                                sendPhotoWebhook(webhookConfig.photoUrl, rotated, device.device.id);
                            }
                        });
                        previousChunk = -1;
                        return;
                    } else {
                        if (id !== previousChunk + 1) {
                            previousChunk = -1;
                            console.error('Invalid chunk', id, previousChunk);
                            return;
                        }
                        previousChunk = id;
                    }
                }

                // Append data
                buffer = new Uint8Array([...buffer, ...data]);
            }

            // Subscribe for photo updates
            const service = await device.getPrimaryService('19B10000-E8F2-537E-4F6C-D104768A1214'.toLowerCase());
            const photoCharacteristic = await service.getCharacteristic('19b10005-e8f2-537e-4f6c-d104768a1214');
            await photoCharacteristic.startNotifications();
            setSubscribed(true);
            photoCharacteristic.addEventListener('characteristicvaluechanged', (e) => {
                let value = (e.target as BluetoothRemoteGATTCharacteristic).value!;
                let array = new Uint8Array(value.buffer);
                if (array[0] == 0xff && array[1] == 0xff) {
                    onChunk(null, new Uint8Array());
                } else {
                    let packetId = array[0] + (array[1] << 8);
                    let packet = array.slice(2);
                    onChunk(packetId, packet);
                }
            });
            // Start automatic photo capture every 5s
            const photoControlCharacteristic = await service.getCharacteristic('19b10006-e8f2-537e-4f6c-d104768a1214');
            await photoControlCharacteristic.writeValue(new Uint8Array([0x05]));
        })();
    }, []);

    return [subscribed, photos] as const;
}

function useAudio(device: BluetoothRemoteGATTServer) {
    const [subscribed, setSubscribed] = React.useState<boolean>(false);
    const [audioPacketsReceived, setAudioPacketsReceived] = React.useState<number>(0);

    React.useEffect(() => {
        (async () => {
            try {
                // Wait 2 seconds for connection to stabilize
                console.log('Waiting for BLE connection to stabilize...');
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Get the OMI service
                const service = await device.getPrimaryService('19B10000-E8F2-537E-4F6C-D104768A1214'.toLowerCase());

                // Subscribe to audio data characteristic
                const audioCharacteristic = await service.getCharacteristic('19b10001-e8f2-537e-4f6c-d104768a1214');
                await audioCharacteristic.startNotifications();

                console.log('Subscribed to audio stream');
                setSubscribed(true);

                let audioBuffer: Uint8Array = new Uint8Array(0);
                let frameIndex = -1;
                let codec = 1; // Default PCM8

                audioCharacteristic.addEventListener('characteristicvaluechanged', (e) => {
                    let value = (e.target as BluetoothRemoteGATTCharacteristic).value!;
                    let array = new Uint8Array(value.buffer);

                    // Check for end marker
                    if (array.length >= 2 && array[0] === 0xff && array[1] === 0xff) {
                        // End of audio buffer - send to webhook
                        if (audioBuffer.length > 0) {
                            const webhookConfig = getWebhookConfig();
                            if (webhookConfig.audioEnabled && webhookConfig.audioUrl) {
                                sendAudioWebhook(webhookConfig.audioUrl, audioBuffer, device.device.id, codec);
                            }
                            setAudioPacketsReceived(prev => prev + 1);
                        }
                        audioBuffer = new Uint8Array(0);
                        frameIndex = -1;
                        return;
                    }

                    // Parse frame index
                    if (array.length < 2) return;
                    const currentFrame = array[0] + (array[1] << 8);

                    // First frame includes codec info
                    if (currentFrame === 0 && array.length > 3) {
                        codec = array[2];
                        audioBuffer = array.slice(3);
                        frameIndex = 0;
                    } else if (frameIndex >= 0 && currentFrame === frameIndex + 1) {
                        // Subsequent frames
                        const newData = array.slice(2);
                        audioBuffer = new Uint8Array([...audioBuffer, ...newData]);
                        frameIndex = currentFrame;
                    } else if (currentFrame === 0) {
                        // Restart
                        audioBuffer = array.slice(2);
                        frameIndex = 0;
                    }
                });

                // Start audio capture by writing to audio control characteristic
                const audioControlCharacteristic = await service.getCharacteristic('19b10002-e8f2-537e-4f6c-d104768a1214');
                await audioControlCharacteristic.writeValue(new Uint8Array([0x01])); // Start audio
                console.log('Audio capture started');

            } catch (e) {
                console.error('Failed to subscribe to audio:', e);
            }
        })();

        // Cleanup on unmount
        return () => {
            (async () => {
                try {
                    if (device.connected) {
                        const service = await device.getPrimaryService('19B10000-E8F2-537E-4F6C-D104768A1214'.toLowerCase());
                        const audioControlCharacteristic = await service.getCharacteristic('19b10002-e8f2-537e-4f6c-d104768a1214');
                        await audioControlCharacteristic.writeValue(new Uint8Array([0x00])); // Stop audio
                        console.log('Audio capture stopped');
                    }
                } catch (e) {
                    // Ignore cleanup errors
                    console.log('Audio cleanup skipped (device disconnected)');
                }
            })();
        };
    }, [device]);

    return [subscribed, audioPacketsReceived] as const;
}

export const DeviceView = React.memo((props: { device: BluetoothRemoteGATTServer }) => {
    const [subscribed, photos] = usePhotos(props.device);
    // Temporarily disable audio to debug connection issues
    // const [audioSubscribed, audioPacketsReceived] = useAudio(props.device);
    const [audioSubscribed, audioPacketsReceived] = [false, 0]; // Disabled
    const agent = React.useMemo(() => new Agent(), []);
    const agentState = agent.use();
    const webhookConfig = getWebhookConfig();

    // Background processing agent
    const processedPhotos = React.useRef<Uint8Array[]>([]);
    const sync = React.useMemo(() => {
        let processed = 0;
        return new InvalidateSync(async () => {
            if (processedPhotos.current.length > processed) {
                let unprocessed = processedPhotos.current.slice(processed);
                processed = processedPhotos.current.length;
                await agent.addPhoto(unprocessed);
            }
        });
    }, []);
    React.useEffect(() => {
        processedPhotos.current = photos.map(p => p.data);
        sync.invalidate();
    }, [photos]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {/* Status Bar */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 10, zIndex: 10 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace' }}>
                    📹 Live Video Stream | 🎤 Audio: {audioPacketsReceived} pkts
                    {webhookConfig.photoEnabled && ` | Photo→Webhook ✓`}
                    {webhookConfig.audioEnabled && ` | Audio→Webhook ✓`}
                </Text>
            </View>

            {/* Display single live image - video-like view */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                {photos.length > 0 ? (
                    <Image
                        style={{ width: '100%', height: '100%' }}
                        source={{ uri: toBase64Image(photos[0].data) }}
                        resizeMode="contain"
                    />
                ) : (
                    <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={{ color: '#888', marginTop: 20, fontSize: 14 }}>
                            Waiting for video stream...
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
});
