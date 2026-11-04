import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as api from './api';

export const familyKeys = {
  root: (userId: string) => ['family-workspace', userId] as const,
  person: (userId: string) => [...familyKeys.root(userId), 'person'] as const,
  families: (userId: string, personId: string) =>
    [...familyKeys.root(userId), 'families', personId] as const,
  people: (userId: string, familyId: string) =>
    [...familyKeys.root(userId), 'people', familyId] as const,
  relationships: (userId: string, familyId: string) =>
    [...familyKeys.root(userId), 'relationships', familyId] as const,
};

export function useCurrentPerson(userId: string) {
  return useQuery({
    queryKey: familyKeys.person(userId),
    queryFn: () => api.getCurrentPerson(userId),
  });
}
export function useFamilies(userId: string, personId: string) {
  return useQuery({
    queryKey: familyKeys.families(userId, personId),
    queryFn: () => api.listFamilies(personId),
  });
}
export function useFamilyPeople(userId: string, familyId: string) {
  return useQuery({
    queryKey: familyKeys.people(userId, familyId),
    queryFn: () => api.listFamilyPeople(userId, familyId),
  });
}
export function useFamilyRelationships(userId: string, familyId: string) {
  return useQuery({
    queryKey: familyKeys.relationships(userId, familyId),
    queryFn: () => api.listFamilyRelationships(familyId),
  });
}

export function useFamilyActions(userId: string) {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: familyKeys.root(userId) });
  const options = {
    onSuccess: refresh,
    onError: refresh,
    networkMode: 'always' as const,
  };
  return {
    onboard: useMutation({ mutationFn: api.onboardPerson, ...options }),
    claim: useMutation({
      mutationFn: api.claimPerson,
      ...options,
      gcTime: 0,
    }),
    createFamily: useMutation({
      mutationFn: api.createFamily,
      ...options,
    }),
    createManaged: useMutation({
      mutationFn: api.createManagedPerson,
      ...options,
    }),
    issueClaim: useMutation({
      mutationFn: api.issueClaim,
      gcTime: 0,
      networkMode: 'always',
    }),
    createRelationship: useMutation({
      mutationFn: api.createFamilyRelationship,
      ...options,
    }),
    deleteRelationship: useMutation({
      mutationFn: api.deleteFamilyRelationship,
      ...options,
    }),
    removeMember: useMutation({
      mutationFn: api.removeFamilyMember,
      ...options,
    }),
    transferOwnership: useMutation({
      mutationFn: api.transferFamilyOwnership,
      ...options,
    }),
    changeRole: useMutation({ mutationFn: api.changeFamilyRole, ...options }),
  };
}
