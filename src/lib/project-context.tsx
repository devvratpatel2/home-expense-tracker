'use client';
import { createContext, useContext } from 'react';

export const ProjectContext = createContext<string>('');
export function useProjectId() { return useContext(ProjectContext); }

// False when the signed-in person is viewing a project someone shared with them.
export const CanEditContext = createContext(true);
export function useCanEdit() { return useContext(CanEditContext); }
