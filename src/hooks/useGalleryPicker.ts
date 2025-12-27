import { useState } from 'react';
import ImagePicker from 'react-native-image-crop-picker';
import { PhotoFile } from 'react-native-vision-camera';

export const useGalleryPicker = () => {
    const [isLoading, setIsLoading] = useState(false);

    const pickImage = async (): Promise<PhotoFile | null> => {
        try {
            setIsLoading(true);

            const image = await ImagePicker.openPicker({
                mediaType: 'photo',
                cropping: true,
                freeStyleCropEnabled: true,
                cropperToolbarTitle: 'Rogner la citation',
                cropperChooseText: 'Valider',
                cropperCancelText: 'Annuler',
                compressImageQuality: 1, // Max quality
                // Force high resolution output
                width: 3000,
                height: 3000,
                compressImageMaxWidth: 4096,
                compressImageMaxHeight: 4096,
            });

            if (!image) {
                return null;
            }

            const cleanPath = image.path.startsWith('file://') ? image.path : `file://${image.path}`;

            // Create a pseudo PhotoFile object
            const pickedPhoto: PhotoFile = {
                path: cleanPath,
                width: image.width,
                height: image.height,
                isRawPhoto: false,
                metadata: { Orientation: 1 } as any, // Default orientation
            } as PhotoFile;

            return pickedPhoto;
        } catch (error: any) {
            if (error?.code !== 'E_PICKER_CANCELLED') {
                console.error('Picker error:', error);
            } else {
                console.log('User cancelled selection');
            }
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
