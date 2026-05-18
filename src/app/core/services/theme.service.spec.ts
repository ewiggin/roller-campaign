import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { ThemeService } from './theme.service';

function setup() {
  TestBed.configureTestingModule({});
  const service = TestBed.inject(ThemeService);
  const document = TestBed.inject(DOCUMENT);
  return { service, document };
}

describe('ThemeService', () => {
  afterEach(() => {
    localStorage.removeItem('theme');
    document.documentElement.classList.remove('dark');
  });

  describe('initial isDark state', () => {
    it('defaults to false when no localStorage and matchMedia returns false', () => {
      vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
      const { service } = setup();
      expect(service.isDark()).toBe(false);
    });

    it('reads dark from localStorage', () => {
      localStorage.setItem('theme', 'dark');
      const { service } = setup();
      expect(service.isDark()).toBe(true);
    });

    it('reads light from localStorage', () => {
      localStorage.setItem('theme', 'light');
      const { service } = setup();
      expect(service.isDark()).toBe(false);
    });

    it('falls back to matchMedia when no localStorage', () => {
      vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
      const { service } = setup();
      expect(service.isDark()).toBe(true);
    });

    it('applies dark class to documentElement on init when dark', () => {
      localStorage.setItem('theme', 'dark');
      const { document } = setup();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('does not apply dark class on init when light', () => {
      localStorage.setItem('theme', 'light');
      const { document } = setup();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('toggle()', () => {
    it('flips isDark from false to true', () => {
      vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
      const { service } = setup();
      expect(service.isDark()).toBe(false);
      service.toggle();
      expect(service.isDark()).toBe(true);
    });

    it('flips isDark from true to false', () => {
      localStorage.setItem('theme', 'dark');
      const { service } = setup();
      service.toggle();
      expect(service.isDark()).toBe(false);
    });

    it('toggle twice returns to original state', () => {
      vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
      const { service } = setup();
      service.toggle();
      service.toggle();
      expect(service.isDark()).toBe(false);
    });

    it('updates localStorage after toggle', async () => {
      vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
      const { service } = setup();
      service.toggle();
      TestBed.flushEffects();
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('updates dark class on documentElement after toggle', async () => {
      vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
      const { service, document } = setup();
      service.toggle();
      TestBed.flushEffects();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });
});
