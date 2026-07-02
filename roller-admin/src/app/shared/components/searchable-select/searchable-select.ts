import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgStyle } from '@angular/common';

export interface SearchableSelectItem {
  value: string;
  label: string;
  meta?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-searchable-select',
  imports: [FormsModule, NgStyle],
  templateUrl: './searchable-select.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true,
    },
  ],
})
export class SearchableSelectComponent implements ControlValueAccessor, OnDestroy {
  readonly items = input<SearchableSelectItem[]>([]);
  readonly placeholder = input('Select…');
  readonly emptyLabel = input('');
  readonly compact = input(false);
  readonly invalid = input(false);
  readonly multi = input(false);
  readonly disabled = input(false);

  // Single mode
  readonly selected = model('');
  // Multi mode
  readonly selectedItems = model<string[]>([]);

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly dropdownStyle = signal<Record<string, string>>({});
  private readonly cvaDisabled = signal(false);

  protected readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  // Short lists don't need a search box; it only adds noise
  protected readonly showSearch = computed(() => this.items().length >= 8);

  @ViewChild('trigger') private readonly triggerEl?: ElementRef<HTMLButtonElement>;
  @ViewChild('searchInput') private readonly searchInput?: ElementRef<HTMLInputElement>;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected readonly selectedLabel = computed(() => {
    if (this.multi()) {
      const sel = this.selectedItems();
      if (!sel.length) return '';
      if (sel.length === 1) return this.items().find((i) => i.value === sel[0])?.label ?? '';
      return `${sel.length} selected`;
    }
    const val = this.selected();
    if (!val) return '';
    return this.items().find((i) => i.value === val)?.label ?? '';
  });

  protected readonly filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.items();
    return this.items().filter(
      (i) => i.label.toLowerCase().includes(q) || (i.meta?.toLowerCase().includes(q) ?? false),
    );
  });

  constructor(private readonly el: ElementRef) {}

  writeValue(value: string): void {
    this.selected.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  // Capture phase, so clicks swallowed by stopPropagation (e.g. modal
  // panels) still reach us and close the dropdown.
  private readonly onDocumentPointerDown = (e: Event) => {
    if (!this.el.nativeElement.contains(e.target as Node)) this.close();
  };
  // The dropdown is position:fixed, so it must follow the trigger when any
  // ancestor (page or modal body) scrolls or the window resizes.
  private readonly onViewportChange = () => this.updateDropdownPosition();

  ngOnDestroy(): void {
    this.removeGlobalListeners();
  }

  protected toggle() {
    this.open() ? this.close() : this.openDropdown();
  }

  protected openDropdown() {
    this.updateDropdownPosition();
    this.query.set('');
    this.open.set(true);
    document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    window.addEventListener('scroll', this.onViewportChange, true);
    window.addEventListener('resize', this.onViewportChange);
    setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
  }

  protected close() {
    this.open.set(false);
    this.query.set('');
    this.removeGlobalListeners();
  }

  private updateDropdownPosition() {
    if (!this.triggerEl) return;
    const rect = this.triggerEl.nativeElement.getBoundingClientRect();
    this.dropdownStyle.set({
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
    });
  }

  private removeGlobalListeners() {
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    window.removeEventListener('scroll', this.onViewportChange, true);
    window.removeEventListener('resize', this.onViewportChange);
  }

  // Single mode: select and close
  protected select(value: string) {
    this.selected.set(value);
    this.onChange(value);
    this.onTouched();
    this.close();
  }

  // Multi mode: toggle without closing
  protected toggleItem(value: string) {
    const current = this.selectedItems();
    this.selectedItems.set(
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  }

  protected isItemSelected(value: string): boolean {
    return this.selectedItems().includes(value);
  }

  protected triggerClass() {
    const py = this.compact() ? 'py-1.5' : 'py-2';
    const border = this.invalid() ? 'border-red-400' : 'border-gray-300 dark:border-zinc-700';
    return `w-full flex items-center justify-between gap-2 rounded-lg border ${border} bg-white dark:bg-[#27272a] text-gray-900 dark:text-zinc-100 px-3 ${py} text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`;
  }
}
