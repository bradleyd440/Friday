import { DeviceService } from '../types/lockMode';

export class SimulatorDeviceService implements DeviceService {
  private intensity = 0;
  private listeners = new Set<(value: number) => void>();

  async setIntensity(value: number): Promise<void> {
    this.intensity = Math.max(0, Math.min(100, Math.round(value)));
    this.listeners.forEach((listener) => listener(this.intensity));
  }

  getIntensity(): number {
    return this.intensity;
  }

  onIntensityChange(listener: (value: number) => void): () => void {
    this.listeners.add(listener);
    listener(this.intensity);
    return () => this.listeners.delete(listener);
  }
}
