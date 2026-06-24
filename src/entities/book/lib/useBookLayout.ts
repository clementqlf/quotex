import { BlockService, type BlockData } from '@/src/shared/api/BlockService';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';

export interface BookLayoutResult {
  gridData: string[];
  blockData: BlockData;
  isLoadingLayout: boolean;
  lastSavedBookBlockData: React.MutableRefObject<string>;
  reloadRef: React.MutableRefObject<() => void>;
  handleUpdateBlockData: (blockId: string, data: BlockData) => void;
  handleOrderChange: (fromIndex: number, toIndex: number) => void;
  handleAddBlock: (blockKey: string) => void;
  handleRemoveBlock: (itemToRemove: string) => void;
  openAddBlockModal: () => void;
  closeAddBlockModal: () => void;
  setAddBlockModalVisible: (value: boolean) => void;
  isAddBlockModalVisible: boolean;
}

interface UseBookLayoutProps {
  bookTitle: string | undefined;
  queryClient: QueryClient;
  bookId: number | undefined;
  bookTitleParam: string | undefined;
  inventaireUriParam: string | undefined;
  onBlockDataChange?: (data: BlockData) => void;
}

export const useBookLayout = (props: UseBookLayoutProps): BookLayoutResult => {
  const { bookTitle, queryClient, bookId, bookTitleParam, inventaireUriParam } = props;
  
  const [gridData, setGridData] = useState<string[]>([]);
  const [blockData, setBlockData] = useState<BlockData>({});
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);
  const [isAddBlockModalVisible, setAddBlockModalVisible] = useState(false);

  const lastSavedBookBlockData = React.useRef<string>('{}');
  const reloadRef = React.useRef<() => void>(() => {});

  // Methods for BlockService
  const getBlockLayout = useCallback((parentId: string | number, parentType: 'quote' | 'book') => {
    return BlockService.getLayout(parentId, parentType);
  }, []);

  const updateBlockLayout = useCallback((parentId: string | number, parentType: 'quote' | 'book', layout: string[]) => {
    return BlockService.saveLayout(parentId, parentType, layout);
  }, []);

  const getBookData = useCallback((bookTitle: string) => {
    return BlockService.getBlockData(bookTitle, 'book');
  }, []);

  const updateBookData = useCallback((bookTitle: string, data: BlockData) => {
    return BlockService.saveBlockData(bookTitle, 'book', data);
  }, []);

  // Load layout and block data
  useEffect(() => {
    if (!bookTitle) return;
    Promise.all([
      getBlockLayout(bookTitle, 'book'),
      getBookData(bookTitle),
    ]).then(([layout, data]) => {
      const filteredLayout = (layout || []).filter(x => x !== 'addBlock');
      setGridData(filteredLayout);
      const resolvedData = data || {};
      lastSavedBookBlockData.current = JSON.stringify(resolvedData);
      setBlockData(resolvedData);
      setIsLoadingLayout(false);
    });
  }, [bookTitle, getBlockLayout, getBookData]);

  // Auto-save block data
  useEffect(() => {
    if (!bookTitle || !blockData) return;

    const dataStr = JSON.stringify(blockData);
    if (dataStr === lastSavedBookBlockData.current) return;

    const timer = setTimeout(() => {
      updateBookData(bookTitle, blockData);
      lastSavedBookBlockData.current = dataStr;
    }, 1000);
    return () => clearTimeout(timer);
  }, [blockData, bookTitle, updateBookData]);

  // Update reloadRef to use query client
  useEffect(() => {
    reloadRef.current = () => {
      queryClient.invalidateQueries({ queryKey: ['book-detail', bookId, bookTitleParam, inventaireUriParam] });
    };
  }, [queryClient, bookId, bookTitleParam, inventaireUriParam]);

  const handleUpdateBlockData = useCallback((blockId: string, data: BlockData) => {
    setBlockData(current => ({ ...current, [blockId]: data }));
  }, []);

  const handleOrderChange = useCallback((fromIndex: number, toIndex: number) => {
    setGridData(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      if (bookTitle) updateBlockLayout(bookTitle, 'book', arr);
      return arr;
    });
  }, [bookTitle, updateBlockLayout]);

  const openAddBlockModal = useCallback(() => setAddBlockModalVisible(true), []);
  const closeAddBlockModal = useCallback(() => setAddBlockModalVisible(false), []);

  const handleAddBlock = useCallback((blockKey: string) => {
    const newLayout = [...gridData.filter(x => x !== 'addBlock'), `${blockKey}#${Date.now()}`];
    setGridData(newLayout);
    if (bookTitle) updateBlockLayout(bookTitle, 'book', newLayout);
    closeAddBlockModal();
  }, [bookTitle, closeAddBlockModal, gridData, updateBlockLayout]);

  const handleRemoveBlock = useCallback((itemToRemove: string) => {
    if (itemToRemove === 'addBlock') return;
    const newLayout = gridData.filter(x => x !== itemToRemove);
    setGridData(newLayout);
    if (bookTitle) updateBlockLayout(bookTitle, 'book', newLayout);
  }, [bookTitle, gridData, updateBlockLayout]);

  return {
    gridData,
    blockData,
    isLoadingLayout,
    lastSavedBookBlockData,
    reloadRef,
    handleUpdateBlockData,
    handleOrderChange,
    handleAddBlock,
    handleRemoveBlock,
    openAddBlockModal,
    closeAddBlockModal,
    setAddBlockModalVisible,
    isAddBlockModalVisible,
  };
};
