import React, { useState, useCallback } from 'react';
import { Platform, Modal } from 'react-native';
import AddQuoteMenu from '@/src/entities/quote/ui/AddQuoteMenu';
import SimpleScanModal, { SimpleScanResult } from '@/src/shared/ui/modals/SimpleScanModal';
import ScanPreviewModal from '@/src/shared/ui/modals/ScanPreviewModal';
import ScanWorkflow from '@/src/features/scanner/ui/ScanWorkflow';
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
  const [activeScanResult, setActiveScanResult] = useState<SimpleScanResult | null>(null);

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
          onSuccess={(result) => {
            setShowSimpleScanModal(false);
            setTimeout(() => {
              setActiveScanResult(result);
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

        <Modal
          visible={!!activeScanResult}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setActiveScanResult(null)}
        >
          {activeScanResult && (
            <ScanWorkflow
              photo={activeScanResult.photo}
              ocrElements={activeScanResult.ocrElements}
              ocrBlocks={activeScanResult.ocrBlocks}
              onReset={() => setActiveScanResult(null)}
              normalizedSize={activeScanResult.normalizedSize}
              initialBook={initialBook}
              initialAuthor={initialAuthor}
              onSave={async (text, book, author) => {
                try {
                  await handleConfirmSave(text, book || '', author || '', {
                    isFromScanner: false,
                  });
                  setActiveScanResult(null);
                  return { success: true };
                } catch (e) {
                  return { success: false, error: e instanceof Error ? e.message : String(e) };
                }
              }}
            />
          )}
        </Modal>
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
    activeScanResult,
    handleConfirmSave,
  ]);

  return {
    openAddQuoteFlow,
    renderQuoteModals,
  };
};
