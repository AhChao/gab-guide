import React, { createContext, useContext } from 'react';
import { useBank, UseBankResult } from './useBank';
import { BankStore } from './store';

/**
 * One Expression Bank instance for the whole app.
 *
 * Why a context and not `useBank()` per section: all three sections stay mounted
 * (AppShell hides inactive panels), so two independent `useBank()` calls would drift —
 * Review adds an expression, Practice's list would not know until a reload. Every
 * section reads and writes through `useBankContext()` so one write refreshes all.
 *
 * Tests: pass `store={createBankStore(createMemoryAdapter())}` to the provider.
 */
const BankCtx = createContext<UseBankResult | null>(null);

export const BankProvider: React.FC<{ store?: BankStore; children: React.ReactNode }> = ({ store, children }) => {
  const bank = useBank(store);
  return <BankCtx.Provider value={bank}>{children}</BankCtx.Provider>;
};

export function useBankContext(): UseBankResult {
  const value = useContext(BankCtx);
  if (!value) throw new Error('useBankContext must be used inside <BankProvider>');
  return value;
}
