import React, { createContext, useContext } from 'react';
import { useCheckins, UseCheckinsResult } from './useCheckins';
import { CheckinStore } from './store';

/**
 * One check-in store instance for the whole app (same reasoning as BankContext:
 * sections stay mounted, so one shared hook keeps every list in step).
 */
const CheckinCtx = createContext<UseCheckinsResult | null>(null);

export const CheckinProvider: React.FC<{ store?: CheckinStore; children: React.ReactNode }> = ({ store, children }) => {
  const checkins = useCheckins(store);
  return <CheckinCtx.Provider value={checkins}>{children}</CheckinCtx.Provider>;
};

export function useCheckinContext(): UseCheckinsResult {
  const value = useContext(CheckinCtx);
  if (!value) throw new Error('useCheckinContext must be used inside <CheckinProvider>');
  return value;
}
