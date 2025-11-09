
export enum VoiceType {
    Male = 'Male',
    Female = 'Female',
}

export interface VoiceOption {
    id: string;
    name: string;
    type: VoiceType;
    voiceName: string; // The specific voice name for the Gemini API
}
