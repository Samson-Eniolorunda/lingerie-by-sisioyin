#!/usr/bin/env python3
"""
CSS Layout Audit Script
Parses styles.css and extracts all layout-related properties,
identifying which have responsive media query overrides.
"""
import re
from collections import defaultdict

CSS_FILE = r"d:\OneDrive\Documents\LBS\assets\css\styles.css"

# Properties we care about
LAYOUT_PROPS = [
    'display', 'grid-template-columns', 'grid-template-rows', 'grid-gap', 'gap',
    'column-gap', 'row-gap', 'flex-direction', 'flex-wrap', 'flex',
    'justify-content', 'align-items', 'align-self',
    'width', 'max-width', 'min-width', 'height', 'max-height', 'min-height',
    'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
    'object-fit', 'overflow', 'overflow-x', 'overflow-y',
    'columns', 'column-count',
]

# Section prefixes for classification
SECTIONS = {
    'Header/Navigation': ['.header', '.nav-', '.logo', '.search-box', '.header-actions', '.hdr-', '.mobile-menu'],
    'Home Page': ['.hero', '.section-', '.category-', '.cta-', '.testimonial-', '.trust-', '.brand-', '.home-'],
    'Shop Page': ['.product-grid', '.card-', '.sidebar-', '.filter-', '.shop-', '.product-', '.sort-'],
    'Dashboard': ['.dash-'],
    'Cart Drawer': ['.cd-'],
    'Mobile Nav Drawer': ['.drawer-'],
    'Modals': ['.modal-', '.auth-', '.consent-', '.review-popup'],
    'Quick View': ['.qm-', '.qv-'],
    'Cart Page': ['.cart-', '.promo-'],
    'Checkout': ['.checkout-', '.ck-'],
    'Contact': ['.contact-', '.info-'],
    'FAQ': ['.faq-'],
    'Size Guide': ['.size-', '.measure-', '.fit-tip'],
    'Track': ['.track-'],
    'Wishlist': ['.wishlist-'],
    'Confirmation': ['.confirmation-', '.confirm-', '.order-'],
    'Legal/Terms': ['.legal-'],
    'WhatsApp Widget': ['.whatsapp-', '.wa-'],
    'Search Overlay': ['.search-'],
    'Footer': ['.footer-'],
    'Toast': ['.toast'],
    'Forms': ['.form-'],
    'Tables': ['table', '.table', 'th', 'td', '.size-table', '.size-guide'],
    'Images/Icons': ['img', '.icon', '.logo-icon', 'i.fa', 'i.bi'],
    'Containers': ['.container', '.wrapper', '.page-'],
}

def classify_selector(selector):
    """Classify selector into a section."""
    sel_lower = selector.lower().strip()
    for section, prefixes in SECTIONS.items():
        for prefix in prefixes:
            if prefix.lower() in sel_lower:
                return section
    return 'Other/Global'

def parse_css(filepath):
    """Parse CSS file and extract declarations with context."""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    results = []  # (line_num, selector, property, value, media_query_context)
    
    # Track nesting
    brace_depth = 0
    current_media = None
    current_selector = None
    selector_start = 0
    media_start = 0
    
    # Buffer for accumulating selector text
    selector_buffer = ""
    in_comment = False
    
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        
        # Handle multi-line comments
        if in_comment:
            if '*/' in stripped:
                in_comment = False
                stripped = stripped[stripped.index('*/') + 2:]
            else:
                continue
        
        if '/*' in stripped:
            if '*/' not in stripped:
                in_comment = True
                stripped = stripped[:stripped.index('/*')]
            else:
                # Single-line comment
                before = stripped[:stripped.index('/*')]
                after = stripped[stripped.index('*/') + 2:]
                stripped = before + after
        
        if not stripped:
            continue
        
        # Check for @media
        media_match = re.match(r'@media\s*(.+?)\s*\{', stripped)
        if media_match:
            current_media = media_match.group(1).strip()
            media_start = i
            brace_depth += 1
            continue
        
        # Check for other @rules we should skip (like @keyframes, @font-face)
        if stripped.startswith('@') and '{' in stripped:
            at_match = re.match(r'@(keyframes|font-face|import|charset)\b', stripped)
            if at_match:
                brace_depth += 1
                continue
        
        # Track braces for closing
        open_braces = stripped.count('{')
        close_braces = stripped.count('}')
        
        # Check for selector (ends with {)
        if '{' in stripped and not stripped.startswith('@'):
            # This is a selector line
            sel_text = stripped.split('{')[0].strip()
            if sel_text:
                current_selector = sel_text
                selector_start = i
            brace_depth += open_braces
            
            # Check if there's also a property on this line after {
            after_brace = stripped.split('{', 1)[1] if '{' in stripped else ''
            if ':' in after_brace and '}' not in after_brace:
                prop_match = re.match(r'\s*([a-z-]+)\s*:\s*(.+?)\s*;?', after_brace)
                if prop_match:
                    prop_name = prop_match.group(1)
                    prop_value = prop_match.group(2).rstrip(';').strip()
                    if prop_name in LAYOUT_PROPS:
                        results.append((i, current_selector, prop_name, prop_value, current_media))
            continue
        
        # Check for closing braces
        if '}' in stripped:
            for _ in range(close_braces):
                brace_depth -= 1
                if brace_depth == 0:
                    current_media = None
                    current_selector = None
                elif brace_depth == 1 and current_media:
                    current_selector = None
            continue
        
        # Check for property declarations
        prop_match = re.match(r'\s*([a-z-]+)\s*:\s*(.+?)\s*;?\s*$', stripped)
        if prop_match and current_selector:
            prop_name = prop_match.group(1)
            prop_value = prop_match.group(2).rstrip(';').strip()
            if prop_name in LAYOUT_PROPS:
                # Filter: only include display if it's grid or flex
                if prop_name == 'display':
                    if 'grid' not in prop_value and 'flex' not in prop_value:
                        continue
                results.append((i, current_selector, prop_name, prop_value, current_media))
    
    return results

def find_responsive_overrides(results):
    """For each base declaration, check if there are media query overrides."""
    # Group by selector + property
    base_declarations = {}  # (selector, prop) -> [(line, value)]
    media_declarations = {}  # (selector, prop) -> [(line, value, media)]
    
    for line, selector, prop, value, media in results:
        key = (selector.strip(), prop)
        if media is None:
            if key not in base_declarations:
                base_declarations[key] = []
            base_declarations[key].append((line, value))
        else:
            if key not in media_declarations:
                media_declarations[key] = []
            media_declarations[key].append((line, value, media))
    
    return base_declarations, media_declarations

def main():
    print("=" * 120)
    print("CSS LAYOUT AUDIT REPORT — styles.css")
    print("=" * 120)
    
    results = parse_css(CSS_FILE)
    base_decls, media_decls = find_responsive_overrides(results)
    
    # Organize by section
    sections = defaultdict(list)
    
    for line, selector, prop, value, media in results:
        section = classify_selector(selector)
        sections[section].append((line, selector, prop, value, media))
    
    # For each section, print a table
    section_order = list(SECTIONS.keys()) + ['Other/Global']
    
    for section in section_order:
        items = sections.get(section, [])
        if not items:
            continue
        
        # Separate base vs media query items
        base_items = [(l, s, p, v, m) for l, s, p, v, m in items if m is None]
        media_items = [(l, s, p, v, m) for l, s, p, v, m in items if m is not None]
        
        if not base_items and not media_items:
            continue
        
        print(f"\n{'='*120}")
        print(f"## {section}")
        print(f"{'='*120}")
        
        if base_items:
            print(f"\n### Base Declarations (outside @media)")
            print(f"{'Line':<8} {'Selector':<55} {'Property':<25} {'Value':<40} {'Has MQ Override?':<20}")
            print("-" * 148)
            
            for line, selector, prop, value, _ in base_items:
                # Check if this selector+prop has media query overrides
                key = (selector.strip(), prop)
                has_override = "YES" if key in media_decls else "NO"
                
                # Truncate long values/selectors
                sel_display = selector[:53] if len(selector) > 53 else selector
                val_display = value[:38] if len(value) > 38 else value
                
                print(f"{line:<8} {sel_display:<55} {prop:<25} {val_display:<40} {has_override:<20}")
        
        if media_items:
            print(f"\n### Media Query Overrides")
            print(f"{'Line':<8} {'Selector':<45} {'Property':<25} {'Value':<35} {'Media Query':<40}")
            print("-" * 153)
            
            for line, selector, prop, value, media in media_items:
                sel_display = selector[:43] if len(selector) > 43 else selector
                val_display = value[:33] if len(value) > 33 else value
                mq_display = media[:38] if len(media) > 38 else media
                print(f"{line:<8} {sel_display:<45} {prop:<25} {val_display:<35} {mq_display:<40}")
    
    # SUMMARY: Items that NEED responsive overrides
    print(f"\n\n{'='*120}")
    print("## CRITICAL: Base declarations WITHOUT responsive overrides")
    print("## (These are the items that likely NEED media query adjustments)")
    print(f"{'='*120}")
    
    # Filter for potentially problematic base declarations
    problems = []
    for line, selector, prop, value, media in results:
        if media is not None:
            continue
        
        key = (selector.strip(), prop)
        has_override = key in media_decls
        
        if has_override:
            continue
        
        # Check if this is potentially problematic
        is_problem = False
        reason = ""
        
        # Grid with multiple columns
        if prop == 'grid-template-columns' and ('repeat(' in value or '1fr 1fr' in value or 'px' in value):
            if '1fr)' in value:
                count_match = re.search(r'repeat\((\d+)', value)
                if count_match and int(count_match.group(1)) > 1:
                    is_problem = True
                    reason = "Multi-column grid without mobile override"
            elif 'px' in value:
                is_problem = True
                reason = "Fixed pixel grid columns"
            elif '1fr 1fr' in value:
                is_problem = True
                reason = "Multi-column grid without mobile override"
        
        # Fixed width/height
        if prop in ('width', 'height', 'min-width', 'min-height'):
            if 'px' in value or 'rem' in value:
                val_num = re.search(r'(\d+)', value)
                if val_num and int(val_num.group(1)) > 200:
                    is_problem = True
                    reason = f"Large fixed {prop}"
        
        # Fixed max-width
        if prop == 'max-width' and 'px' in value:
            val_num = re.search(r'(\d+)', value)
            if val_num and int(val_num.group(1)) > 600:
                is_problem = True
                reason = "Large fixed max-width"
        
        # Fixed padding/margin
        if prop in ('padding', 'padding-left', 'padding-right') and 'px' in value:
            val_num = re.search(r'(\d+)', value)
            if val_num and int(val_num.group(1)) > 40:
                is_problem = True
                reason = f"Large fixed {prop}"
        
        # Gap
        if prop in ('gap', 'column-gap', 'row-gap') and 'px' in value:
            val_num = re.search(r'(\d+)', value)
            if val_num and int(val_num.group(1)) > 24:
                is_problem = True
                reason = f"Large fixed {prop}"
        
        # Flex without wrap
        if prop == 'display' and 'flex' in value:
            # Check if there's a flex-wrap for same selector
            wrap_key = (selector.strip(), 'flex-wrap')
            if wrap_key not in base_decls:
                # Check if it's a layout flex (not just a small button)
                pass  # This would need more context
        
        if is_problem:
            section = classify_selector(selector)
            problems.append((section, line, selector, prop, value, reason))
    
    if problems:
        # Group by section
        prob_sections = defaultdict(list)
        for section, line, selector, prop, value, reason in problems:
            prob_sections[section].append((line, selector, prop, value, reason))
        
        for section in section_order:
            items = prob_sections.get(section, [])
            if not items:
                continue
            
            print(f"\n### {section}")
            print(f"{'Line':<8} {'Selector':<55} {'Property':<25} {'Value':<40} {'Issue':<35}")
            print("-" * 163)
            for line, selector, prop, value, reason in items:
                sel_display = selector[:53] if len(selector) > 53 else selector
                val_display = value[:38] if len(value) > 38 else value
                print(f"{line:<8} {sel_display:<55} {prop:<25} {val_display:<40} {reason:<35}")
    
    # Print stats
    total_base = sum(1 for l, s, p, v, m in results if m is None)
    total_media = sum(1 for l, s, p, v, m in results if m is not None)
    total_problems = len(problems)
    
    print(f"\n\n{'='*120}")
    print(f"SUMMARY STATISTICS")
    print(f"{'='*120}")
    print(f"Total base layout declarations:      {total_base}")
    print(f"Total media query overrides:          {total_media}")
    print(f"Critical items needing MQ overrides:  {total_problems}")
    print(f"Total layout declarations found:      {len(results)}")

if __name__ == '__main__':
    main()
