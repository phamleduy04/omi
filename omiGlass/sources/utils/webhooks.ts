/**
 * Send audio data to webhook
 */
export async function sendAudioWebhook(
    url: string,
    audioData: Uint8Array,
    deviceId: string,
    codec: number = 1
): Promise<boolean> {
    if (!url || url.trim() === '') return false;

    try {
        // Convert to base64
        const base64Data = btoa(String.fromCharCode(...audioData));

        const payload = {
            type: 'glass_audio_bytes',
            device_id: deviceId,
            timestamp: Date.now(),
            codec: codec,
            sample_rate: 16000,
            data: base64Data,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error('Audio webhook failed:', response.status, response.statusText);
            return false;
        }

        console.log('Audio webhook sent successfully:', audioData.length, 'bytes');
        return true;
    } catch (error) {
        console.error('Error sending audio webhook:', error);
        return false;
    }
}

/**
 * Send photo data to webhook
 */
export async function sendPhotoWebhook(
    url: string,
    photoData: Uint8Array,
    deviceId: string
): Promise<boolean> {
    if (!url || url.trim() === '') return false;

    try {
        // Convert to base64
        const base64Data = btoa(String.fromCharCode(...photoData));

        const payload = {
            type: 'glass_photo',
            device_id: deviceId,
            timestamp: Date.now(),
            format: 'jpeg',
            data: base64Data,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error('Photo webhook failed:', response.status, response.statusText);
            return false;
        }

        console.log('Photo webhook sent successfully:', photoData.length, 'bytes');
        return true;
    } catch (error) {
        console.error('Error sending photo webhook:', error);
        return false;
    }
}

/**
 * Get stored webhook configuration
 */
export function getWebhookConfig() {
    return {
        audioUrl: localStorage.getItem('webhook_audio_url') || '',
        photoUrl: localStorage.getItem('webhook_photo_url') || '',
        audioEnabled: localStorage.getItem('webhook_audio_enabled') === 'true',
        photoEnabled: localStorage.getItem('webhook_photo_enabled') === 'true',
    };
}
