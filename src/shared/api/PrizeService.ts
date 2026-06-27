import { supabase } from './supabase';
import { LiteraryPrize } from './types';

export const PrizeService = {
  async getAll(): Promise<LiteraryPrize[]> {
    const { data, error } = await supabase
      .from('LiteraryPrize')
      .select(`
        *,
        laureates:Laureate (
          *,
          author:Author (*),
          book:Book (*)
        )
      `)
      .order('name');

    if (error) throw error;
    return (data as any) || [];
  },

  async getById(id: number): Promise<LiteraryPrize | null> {
    const { data, error } = await supabase
      .from('LiteraryPrize')
      .select(`
        *,
        laureates:Laureate (
          *,
          author:Author (*),
          book:Book (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as any;
  },

  async syncPrize(params: { prizeName?: string; prizeUri?: string; offset?: number; limit?: number }) {
    const { data, error } = await supabase.functions.invoke('sync-prizes', {
      body: params,
    });

    if (error) throw error;
    return data;
  }
};
