import { VoiceOption, VoiceType } from './types';

export const AVAILABLE_VOICES: VoiceOption[] = [
    { id: 'male-1', name: 'Male Voice 1', type: VoiceType.Male, voiceName: 'Kore' },
    { id: 'female-1', name: 'Female Voice 1', type: VoiceType.Female, voiceName: 'Puck' },
    { id: 'male-2', name: 'Male Voice 2', type: VoiceType.Male, voiceName: 'Charon' },
    { id: 'female-2', name: 'Female Voice 2', type: VoiceType.Female, voiceName: 'Zephyr' },
];