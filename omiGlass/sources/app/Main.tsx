import * as React from 'react';
import { SafeAreaView, StyleSheet, View, Text, ScrollView } from 'react-native';
import { RoundButton } from './components/RoundButton';
import { Theme } from './components/theme';
import { useDevice } from '../modules/useDevice';
import { DeviceView } from './DeviceView';
import { WebhookConfig } from './WebhookConfig';
import { startAudio } from '../modules/openai';

export const Main = React.memo(() => {

    const [device, connectDevice, isAutoConnecting] = useDevice();
    const [isConnecting, setIsConnecting] = React.useState(false);
    
    // Handle connection attempt
    const handleConnect = React.useCallback(async () => {
        setIsConnecting(true);
        try {
            await connectDevice();
        } finally {
            setIsConnecting(false);
        }
    }, [connectDevice]);
    
    return (
        <SafeAreaView style={styles.container}>
            {!device && (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                        {isConnecting ? (
                            <Text style={styles.statusText}>Connecting to OMI Glass...</Text>
                        ) : (
                            <>
                                <Text style={styles.title}>OMI Glass Webhook Tester</Text>
                                <Text style={styles.subtitle}>
                                    Configure webhooks below, then connect to your device
                                </Text>
                                <RoundButton title="Connect to Device" action={handleConnect} />
                            </>
                        )}
                    </View>

                    {!isConnecting && (
                        <View style={{ paddingBottom: 32 }}>
                            <WebhookConfig />
                        </View>
                    )}
                </ScrollView>
            )}
            {device && (
                <DeviceView device={device} />
            )}
        </SafeAreaView>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.background,
        alignItems: 'stretch',
        justifyContent: 'center',
    },
    title: {
        color: Theme.text,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        color: Theme.textSecondary,
        fontSize: 14,
        marginBottom: 24,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    statusText: {
        color: Theme.text,
        fontSize: 18,
        marginBottom: 16,
    }
});