import { PrizeService } from './PrizeService';

const mockFrom = jest.fn();
const mockInvoke = jest.fn();

jest.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    functions: {
      invoke: (name: string, options?: any) => mockInvoke(name, options),
    },
  },
}));

describe('PrizeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should successfully fetch all literary prizes ordered by name', async () => {
      const mockPrizes = [
        { id: 1, name: 'Goncourt', laureates: [] },
        { id: 2, name: 'Renaudot', laureates: [] },
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: mockPrizes, error: null });
      const mockSelect = jest.fn().mockReturnValue({ order: mockOrder });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await PrizeService.getAll();

      expect(mockFrom).toHaveBeenCalledWith('LiteraryPrize');
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('laureates:Laureate'));
      expect(mockOrder).toHaveBeenCalledWith('name');
      expect(result).toEqual(mockPrizes);
    });

    it('should return an empty array if data is null', async () => {
      const mockOrder = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockSelect = jest.fn().mockReturnValue({ order: mockOrder });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await PrizeService.getAll();
      expect(result).toEqual([]);
    });

    it('should throw an error if supabase returns an error', async () => {
      const mockError = new Error('Supabase retrieval failed');
      const mockOrder = jest.fn().mockResolvedValue({ data: null, error: mockError });
      const mockSelect = jest.fn().mockReturnValue({ order: mockOrder });
      mockFrom.mockReturnValue({ select: mockSelect });

      await expect(PrizeService.getAll()).rejects.toThrow('Supabase retrieval failed');
    });
  });

  describe('getById', () => {
    it('should successfully fetch a single prize by id', async () => {
      const mockPrize = { id: 42, name: 'Goncourt', laureates: [] };

      const mockSingle = jest.fn().mockResolvedValue({ data: mockPrize, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await PrizeService.getById(42);

      expect(mockFrom).toHaveBeenCalledWith('LiteraryPrize');
      expect(mockEq).toHaveBeenCalledWith('id', 42);
      expect(result).toEqual(mockPrize);
    });

    it('should throw an error if supabase returns an error', async () => {
      const mockError = new Error('Not found or database error');
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      await expect(PrizeService.getById(42)).rejects.toThrow('Not found or database error');
    });
  });

  describe('syncPrize', () => {
    it('should successfully invoke the sync-prizes supabase function', async () => {
      const params = { prizeName: 'Goncourt', offset: 0, limit: 10 };
      const mockResponseData = { success: true, count: 5 };

      mockInvoke.mockResolvedValue({ data: mockResponseData, error: null });

      const result = await PrizeService.syncPrize(params);

      expect(mockInvoke).toHaveBeenCalledWith('sync-prizes', { body: params });
      expect(result).toEqual(mockResponseData);
    });

    it('should throw an error if invocation returns an error', async () => {
      const mockError = new Error('Functions error');
      mockInvoke.mockResolvedValue({ data: null, error: mockError });

      await expect(PrizeService.syncPrize({})).rejects.toThrow('Functions error');
    });
  });
});
