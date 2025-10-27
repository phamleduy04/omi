import * as React from 'react';
import { View, Text, TextInput, StyleSheet, Switch } from 'react-native';
import { Theme } from './components/theme';

const WEBHOOK_AUDIO_URL_KEY = 'webhook_audio_url';
const WEBHOOK_PHOTO_URL_KEY = 'webhook_photo_url';
const WEBHOOK_AUDIO_ENABLED_KEY = 'webhook_audio_enabled';
const WEBHOOK_PHOTO_ENABLED_KEY = 'webhook_photo_enabled';

export function useWebhookConfig() {
    const [audioWebhookUrl, setAudioWebhookUrl] = React.useState('');
    const [photoWebhookUrl, setPhotoWebhookUrl] = React.useState('');
    const [audioEnabled, setAudioEnabled] = React.useState(false);
    const [photoEnabled, setPhotoEnabled] = React.useState(false);

    // Load from localStorage on mount
    React.useEffect(() => {
        const savedAudioUrl = localStorage.getItem(WEBHOOK_AUDIO_URL_KEY);
        const savedPhotoUrl = localStorage.getItem(WEBHOOK_PHOTO_URL_KEY);
        const savedAudioEnabled = localStorage.getItem(WEBHOOK_AUDIO_ENABLED_KEY) === 'true';
        const savedPhotoEnabled = localStorage.getItem(WEBHOOK_PHOTO_ENABLED_KEY) === 'true';

        if (savedAudioUrl) setAudioWebhookUrl(savedAudioUrl);
        if (savedPhotoUrl) setPhotoWebhookUrl(savedPhotoUrl);
        setAudioEnabled(savedAudioEnabled);
        setPhotoEnabled(savedPhotoEnabled);
    }, []);

    // Save to localStorage when changed
    const updateAudioUrl = React.useCallback((url: string) => {
        setAudioWebhookUrl(url);
        localStorage.setItem(WEBHOOK_AUDIO_URL_KEY, url);
    }, []);

    const updatePhotoUrl = React.useCallback((url: string) => {
        setPhotoWebhookUrl(url);
        localStorage.setItem(WEBHOOK_PHOTO_URL_KEY, url);
    }, []);

    const toggleAudioEnabled = React.useCallback((enabled: boolean) => {
        setAudioEnabled(enabled);
        localStorage.setItem(WEBHOOK_AUDIO_ENABLED_KEY, enabled.toString());
    }, []);

    const togglePhotoEnabled = React.useCallback((enabled: boolean) => {
        setPhotoEnabled(enabled);
        localStorage.setItem(WEBHOOK_PHOTO_ENABLED_KEY, enabled.toString());
    }, []);

    return {
        audioWebhookUrl,
        photoWebhookUrl,
        audioEnabled,
        photoEnabled,
        updateAudioUrl,
        updatePhotoUrl,
        toggleAudioEnabled,
        togglePhotoEnabled,
    };
}

export const WebhookConfig = React.memo(() => {
    const {
        audioWebhookUrl,
        photoWebhookUrl,
        audioEnabled,
        photoEnabled,
        updateAudioUrl,
        updatePhotoUrl,
        toggleAudioEnabled,
        togglePhotoEnabled,
    } = useWebhookConfig();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Webhook Configuration</Text>

            {/* Photo Webhook */}
            <View style={styles.section}>
                <View style={styles.header}>
                    <Text style={styles.label}>Photo Webhook</Text>
                    <Switch
                        value={photoEnabled}
                        onValueChange={togglePhotoEnabled}
                        trackColor={{ false: '#767577', true: Theme.accent }}
                        thumbColor={photoEnabled ? Theme.accentLight : '#f4f3f4'}
                    />
                </View>
                <TextInput
                    style={[styles.input, !photoEnabled && styles.inputDisabled]}
                    placeholder="https://your-server.com/photos"
                    placeholderTextColor="#666"
                    value={photoWebhookUrl}
                    onChangeText={updatePhotoUrl}
                    editable={photoEnabled}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            {/* Audio Webhook */}
            <View style={styles.section}>
                <View style={styles.header}>
                    <Text style={styles.label}>Audio Webhook</Text>
                    <Switch
                        value={audioEnabled}
                        onValueChange={toggleAudioEnabled}
                        trackColor={{ false: '#767577', true: Theme.accent }}
                        thumbColor={audioEnabled ? Theme.accentLight : '#f4f3f4'}
                    />
                </View>
                <TextInput
                    style={[styles.input, !audioEnabled && styles.inputDisabled]}
                    placeholder="https://your-server.com/audio"
                    placeholderTextColor="#666"
                    value={audioWebhookUrl}
                    onChangeText={updateAudioUrl}
                    editable={audioEnabled}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            <Text style={styles.info}>
                URLs are saved automatically. Toggle switches to enable/disable webhooks.
            </Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: Theme.background,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Theme.text,
        marginBottom: 16,
    },
    section: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Theme.text,
    },
    input: {
        backgroundColor: Theme.border,
        color: Theme.text,
        padding: 12,
        borderRadius: 8,
        fontSize: 14,
        fontFamily: 'monospace',
    },
    inputDisabled: {
        opacity: 0.5,
    },
    info: {
        fontSize: 12,
        color: Theme.textSecondary,
        marginTop: 8,
        fontStyle: 'italic',
    },
});
