import { RoomTemplate } from './DungeonGenerator';

export class RoomManager {
  private templates: RoomTemplate[] = [];

  registerTemplate(template: RoomTemplate): void {
    this.templates.push(template);
  }

  getTemplatesByType(type: string): RoomTemplate[] {
    return this.templates.filter(t => t.type === type);
  }

  getRandomTemplate(type: string): RoomTemplate | undefined {
    const pool = this.getTemplatesByType(type);
    if (pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
