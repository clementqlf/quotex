import React, { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AddQuoteMenu from '@/src/entities/quote/ui/AddQuoteMenu';
import SimpleScanModal from '@/src/features/scanner/ui/SimpleScanModal';
import ScanPreviewModal from '@/src/features/scanner/ui/ScanPreviewModal';
import { useQuoteActions } from './useQuoteActions';

interface UseQuoteCreationFlowProps {
  initialBook?: string;
  initialAuthor?: string;
}

export const useQuoteCreationFlow = ({
  initialBook = '',
  initialAuthor = '',
}: UseQuoteCreationFlowProps = {}) => {
  const [showAddQuoteModal, setShowAddQuoteModal] = useState(false);
  const [showAddQuoteMenu, setShowAddQuoteMenu] = useState(false);
  const [menuTriggerY, setMenuTriggerY] = useState<number | undefined>(undefined);
  const [showSimpleScanModal, setShowSimpleScanModal] = useState(false);
  const [scannedText, setScannedText] = useState('');

  const { handleConfirmSave } = useQuoteActions();

  const handleConfirmAddQuote = useCallback(
    async (text: string, bookTitle: string, authorName: string) => {
      await handleConfirmSave(text, bookTitle, authorName, {
        setShowModal: setShowAddQuoteModal,
        isFromScanner: false,
      });
    },
    [handleConfirmSave]
  );

  const openAddQuoteFlow = useCallback((pageY?: number) => {
    setMenuTriggerY(pageY);
    setShowAddQuoteMenu(true);
  }, []);

  const renderQuoteModals = useCallback(() => {
    return (
      <>
        <AddQuoteMenu
          visible={showAddQuoteMenu}
          triggerY={menuTriggerY}
          onClose={() => {
            setShowAddQuoteMenu(false);
            setMenuTriggerY(undefined);
          }}
          onScanPress={() => {
            setShowAddQuoteMenu(false);
            setTimeout(() => {
              setShowSimpleScanModal(true);
            }, Platform.OS === 'ios' ? 350 : 50);
          }}
          onManualAddPress={() => {
            setShowAddQuoteMenu(false);
            setScannedText('');
            setTimeout(() => {
              setShowAddQuoteModal(true);
            }, Platform.OS === 'ios' ? 350 : 50);
          }}
        />

        <SimpleScanModal
          visible={showSimpleScanModal}
          onClose={() => setShowSimpleScanModal(false)}
          onSuccess={(text) => {
            setShowSimpleScanModal(false);
            setScannedText(text);
            setTimeout(() => {
              setShowAddQuoteModal(true);
            }, Platform.OS === 'ios' ? 350 : 50);
          }}
        />

        <ScanPreviewModal
          visible={showAddQuoteModal}
          onClose={() => {
            setShowAddQuoteModal(false);
            setScannedText('');
          }}
          onConfirm={handleConfirmAddQuote}
          scannedText={scannedText}
          initialBook={initialBook}
          initialAuthor={initialAuthor}
        />
      </>
    );
  }, [
    showAddQuoteMenu,
    menuTriggerY,
    showSimpleScanModal,
    showAddQuoteModal,
    scannedText,
    handleConfirmAddQuote,
    initialBook,
    initialAuthor,
  ]);

  return {
    openAddQuoteFlow,
    renderQuoteModals,
  };
};
