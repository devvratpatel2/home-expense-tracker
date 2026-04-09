'use client';
import { createContext, useContext } from 'react';

export const ProjectContext = createContext<string>('');
export function useProjectId() { return useContext(ProjectContext); }
