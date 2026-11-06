import { requireNativeModule } from 'expo';

export default requireNativeModule<{
  prepareAsync(): Promise<void>;
  recognizeAsync(uri: string, language: string): Promise<string>;
}>('RecipePhoto');
