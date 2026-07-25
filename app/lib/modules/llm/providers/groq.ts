import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export default class GroqProvider extends BaseProvider {
  name = 'Groq';
  getApiKeyLink = 'https://console.groq.com/keys';

  config = {
    apiTokenKey: 'GROQ_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Seul modèle activé : llama-3.1-8b-instant (20 000 TPM sur tier gratuit Groq)
    {
      name: 'llama-3.1-8b-instant',
      label: 'Llama 3.1 8B Instant',
      provider: 'Groq',
      maxTokenAllowed: 8000,
      maxCompletionTokens: 2048,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'GROQ_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.groq.com/openai/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;

    // Tier gratuit Groq : garder uniquement llama-3.1-8b-instant (20 000 TPM)
    // Les autres modèles (70B, etc.) ont des limites TPM trop basses (12 000)
    const ALLOWED_MODELS = ['llama-3.1-8b-instant'];

    const data = res.data.filter(
      (model: any) =>
        model.object === 'model' &&
        model.active &&
        ALLOWED_MODELS.includes(model.id),
    );

    return data.map((m: any) => ({
      name: m.id,
      label: `${m.id} - context ${m.context_window ? Math.floor(m.context_window / 1000) + 'k' : 'N/A'} [ by ${m.owned_by}]`,
      provider: this.name,
      maxTokenAllowed: 8000,
      maxCompletionTokens: 2048,
    }));
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'GROQ_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const groq = createGroq({ apiKey });

    return groq(model);
  }
}