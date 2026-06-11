import { Component, ElementRef, HostListener, ViewChild, model, signal } from '@angular/core';
import { NgStyle } from '@angular/common';

export const ACTIVITY_EMOJIS = [
  '✈️',
  '🚗',
  '🚌',
  '🚐',
  '🚁',
  '🚂',
  '🛳️',
  '🚑',
  '🏠',
  '🏛️',
  '⛪',
  '🏟️',
  '🏪',
  '🌳',
  '🏖️',
  '⛰️',
  '🎤',
  '🎵',
  '🎶',
  '📚',
  '🙏',
  '❤️',
  '⭐',
  '🎯',
  '👥',
  '🤝',
  '🫂',
  '🤲',
  '🙌',
  '💪',
  '🫶',
  '✊',
  '🎉',
  '🎊',
  '🎗️',
  '🏆',
  '🎁',
  '🎈',
  '📅',
  '🗓️',
  '🌸',
  '🌻',
  '☀️',
  '🌙',
  '⛅',
  '🌈',
  '🍃',
  '🌊',
  '📋',
  '📢',
  '🔔',
  '💡',
  '🔑',
  '📦',
  '📍',
  '🛍️',
  '☕',
  '🍕',
  '🍽️',
  '🥗',
  '🍰',
  '🧃',
  '🍎',
  '🥪',
];

@Component({
  selector: 'app-emoji-picker',
  imports: [NgStyle],
  templateUrl: './emoji-picker.html',
})
export class EmojiPickerComponent {
  readonly value = model('');
  readonly emojis = ACTIVITY_EMOJIS;

  protected readonly open = signal(false);
  protected readonly panelStyle = signal<Record<string, string>>({});

  @ViewChild('trigger') private readonly triggerEl?: ElementRef<HTMLButtonElement>;

  constructor(private readonly el: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (!this.el.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  protected toggle() {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    if (this.triggerEl) {
      const rect = this.triggerEl.nativeElement.getBoundingClientRect();
      this.panelStyle.set({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
      });
    }
    this.open.set(true);
  }

  protected select(emoji: string) {
    this.value.set(emoji);
    this.open.set(false);
  }

  protected clear() {
    this.value.set('');
    this.open.set(false);
  }
}
