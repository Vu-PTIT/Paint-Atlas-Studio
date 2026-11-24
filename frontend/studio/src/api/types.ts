import type { components } from './generated';

type Draft = components['schemas']['Draft'];
export type Crop = Required<components['schemas']['Crop']>;
export type FullDraft = Required<Omit<Draft, 'crop'>> & { crop: Crop };

export interface Version {
  id: string;
  label: string;
  created: string;
  revision: number;
}

export interface Project {
  id: string;
  revision: number;
  updated: string;
  draft: FullDraft;
  versions: Version[];
}

export interface Job {
  id: string;
  draft_revision: number | null;
  project: string;
  title: string;
  action: string;
  status: string;
  stage: string;
  created: string;
  error: string | null;
  result: {
    version?: string;
    style?: string;
    palette?: string[];
    subject_notes?: string;
    objects?: number;
  } | null;
}
