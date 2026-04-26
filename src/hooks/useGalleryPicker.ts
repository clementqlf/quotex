import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { PhotoFile } from 'react-native-vision-camera';

export const useGalleryPicker = () => {
    const [isLoading, setIsLoading] = useState(false);

    const pickImage = async (): Promise<PhotoFile | null> => {
        try {
            setIsLoading(true);

            // Request permissions
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                console.log('Permission refusée pour la galerie');
                return null;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true, // Allows cropping
                quality: 1,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return null;
            }

            const asset = result.assets[0];
            const cleanPath = asset.uri.startsWith('file://') ? asset.uri : `file://${asset.uri}`;

            // Create a pseudo PhotoFile object compatible with VisionCamera
            const pickedPhoto: PhotoFile = {
                path: cleanPath,
                width: asset.width,
                height: asset.height,
                isRawPhoto: false,
                metadata: { Orientation: 1 } as any,
            } as PhotoFile;

            return pickedPhoto;
        } catch (error: any) {
            console.error('Picker error:', error);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        pickImage,
        isLoading,
    };
};
