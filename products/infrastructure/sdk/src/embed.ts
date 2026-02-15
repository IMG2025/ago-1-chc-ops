/**
 * CoreIdentity Platform SDK
 * Embeddable governance for other platforms
 */

export interface EmbedConfig {
  apiKey: string;
  customerId: string;
  theme?: {
    primary: string;
    secondary: string;
  };
  features?: {
    killSwitches?: boolean;
    anomalyDetection?: boolean;
    auditTrail?: boolean;
  };
}

export class CoreIdentityEmbed {
  private config: EmbedConfig;
  private iframe: HTMLIFrameElement | null = null;

  constructor(config: EmbedConfig) {
    this.config = config;
  }

  /**
   * Embed governance dashboard in customer's platform
   */
  embedDashboard(container: HTMLElement): void {
    const iframe = document.createElement('iframe');
    iframe.src = `https://platform.coreidentity.ai/embed/dashboard?customer=${this.config.customerId}`;
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    
    container.appendChild(iframe);
    this.iframe = iframe;
  }

  /**
   * Embed kill switch controls
   */
  embedKillSwitch(container: HTMLElement): void {
    const iframe = document.createElement('iframe');
    iframe.src = `https://platform.coreidentity.ai/embed/killswitch?customer=${this.config.customerId}`;
    iframe.style.width = '100%';
    iframe.style.height = '400px';
    iframe.style.border = 'none';
    
    container.appendChild(iframe);
  }

  /**
   * Call governance API directly
   */
  async checkAuthorization(params: {
    agentId: string;
    action: string;
    resource: string;
  }): Promise<{ allowed: boolean; reason?: string }> {
    const response = await fetch('https://api.coreidentity.ai/v1/governance/authorize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    return response.json();
  }

  /**
   * Activate kill switch
   */
  async activateKillSwitch(params: {
    level: 'agent' | 'domain' | 'global';
    targetId: string;
    reason: string;
  }): Promise<{ success: boolean }> {
    const response = await fetch('https://api.coreidentity.ai/v1/governance/killswitch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    return response.json();
  }

  destroy(): void {
    if (this.iframe && this.iframe.parentElement) {
      this.iframe.parentElement.removeChild(this.iframe);
      this.iframe = null;
    }
  }
}

// Example usage for platform integrations
const embed = new CoreIdentityEmbed({
  apiKey: 'platform_api_key',
  customerId: 'customer_123',
  theme: {
    primary: '#4f46e5',
    secondary: '#10b981'
  }
});

// Embed in their platform
const container = document.getElementById('governance-dashboard');
if (container) {
  embed.embedDashboard(container);
}
