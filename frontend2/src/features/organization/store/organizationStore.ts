import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrganizationStore {
    currentOrgId: number | null;
    setCurrentOrgId: (id: number | null) => void;
}

export const useOrganizationStore = create<OrganizationStore>()(
    persist(
        (set) => ({
            currentOrgId: null,
            setCurrentOrgId: (id) => set({ currentOrgId: id }),
        }),
        {
            name: 'organization-storage',
        }
    )
);
