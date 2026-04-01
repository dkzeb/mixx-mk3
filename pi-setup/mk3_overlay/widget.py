"""Widget, Page, and Item base classes for the MK3 overlay system."""


class ActionItem:
    def __init__(self, label, on_execute=None, confirm=False):
        self.label = label
        self.on_execute = on_execute
        self.confirm = confirm
        self.selectable = True


class ToggleItem:
    def __init__(self, label, state=False, on_toggle=None):
        self.label = label
        self.state = state
        self.on_toggle = on_toggle
        self.selectable = True


class InfoItem:
    def __init__(self, label, value_fn=None):
        self.label = label
        self.value_fn = value_fn
        self.selectable = False

    def get_value(self):
        if self.value_fn:
            return self.value_fn()
        return ""


class Page:
    def __init__(self, title, items=None, knob_bindings=None, d_button_bindings=None):
        self.title = title
        self.items = items or []
        self.knob_bindings = knob_bindings or {}
        self.d_button_bindings = d_button_bindings or {}

    def first_selectable(self):
        for i, item in enumerate(self.items):
            if item.selectable:
                return i
        return 0

    def next_selectable(self, current, direction):
        n = len(self.items)
        if n == 0:
            return 0
        idx = current
        for _ in range(n):
            idx = (idx + direction) % n
            if self.items[idx].selectable:
                return idx
        return current


class Widget:
    def __init__(self, name, position, activate_button, pages):
        self.name = name
        self.position = position
        self.activate_button = activate_button
        self.pages = pages
        self.current_page = 0
        self.cursor = self.pages[0].first_selectable() if pages else 0
        self.confirming = False

    @property
    def page(self):
        return self.pages[self.current_page]

    def move_cursor(self, direction):
        self.confirming = False
        self.cursor = self.page.next_selectable(self.cursor, direction)

    def switch_page(self, direction):
        self.confirming = False
        self.current_page = (self.current_page + direction) % len(self.pages)
        self.cursor = self.page.first_selectable()
        self.on_page_enter()

    def jump_to_page(self, index):
        if 0 <= index < len(self.pages):
            self.confirming = False
            self.current_page = index
            self.cursor = self.page.first_selectable()
            self.on_page_enter()

    def execute_item(self):
        items = self.page.items
        if self.cursor >= len(items):
            return
        item = items[self.cursor]
        if isinstance(item, ToggleItem):
            item.state = not item.state
            if item.on_toggle:
                item.on_toggle(item.state)
            return
        if isinstance(item, ActionItem):
            if item.confirm and not self.confirming:
                self.confirming = True
                return
            self.confirming = False
            if item.on_execute:
                item.on_execute()

    def cancel_confirm(self):
        self.confirming = False

    def on_page_enter(self):
        pass

    def on_activate(self):
        self.current_page = 0
        self.cursor = self.page.first_selectable()
        self.confirming = False
        self.on_page_enter()

    def on_deactivate(self):
        self.confirming = False
