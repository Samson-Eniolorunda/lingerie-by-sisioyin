#!/usr/bin/env python3
"""
CSS Layout Audit Script v2 — Clean Markdown Output
"""
import re
from collections import defaultdict

CSS_FILE = r"d:\OneDrive\Documents\LBS\assets\css\styles.css"

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
    'Tables': ['table', '.table', 'th ', 'td ', '.size-table', '.size-guide'],
    'Images/Icons': ['img', '.icon', '.logo-icon', 'i.fa', 'i.bi'],
    'Containers': ['.container', '.wrapper', '.page-'],
}

def classify_selector(selector):
    sel_lower = selector.lower().strip()
    for section, prefixes in SECTIONS.items():
        for prefix in prefixes:
            if prefix.lower() in sel_lower:
                return section
    return 'Other/Global'

def parse_css(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    results = []
    brace_depth = 0
    current_media = None
    current_selector = None
    in_comment = False
    in_keyframes = False
    keyframes_depth = 0

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

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
                before = stripped[:stripped.index('/*')]
                after = stripped[stripped.index('*/') + 2:]
                stripped = before + after

        if not stripped:
            continue

        # Skip @keyframes blocks
        if re.match(r'@keyframes\b', stripped):
            in_keyframes = True
            keyframes_depth = 0
            keyframes_depth += stripped.count('{') - stripped.count('}')
            continue
        if in_keyframes:
            keyframes_depth += stripped.count('{') - stripped.count('}')
            if keyframes_depth <= 0:
                in_keyframes = False
            continue

        # @media
        media_match = re.match(r'@media\s*(.+?)\s*\{', stripped)
        if media_match:
            current_media = media_match.group(1).strip()
            brace_depth += 1
            continue

        # Skip other @rules
        if stripped.startswith('@') and '{' in stripped:
            at_match = re.match(r'@(font-face|import|charset|supports)\b', stripped)
            if at_match:
                brace_depth += 1
                continue

        open_braces = stripped.count('{')
        close_braces = stripped.count('}')

        if '{' in stripped and not stripped.startswith('@'):
            sel_text = stripped.split('{')[0].strip()
            if sel_text:
                current_selector = sel_text
            brace_depth += open_braces

            after_brace = stripped.split('{', 1)[1] if '{' in stripped else ''
            if ':' in after_brace and '}' not in after_brace:
                prop_match = re.match(r'\s*([a-z-]+)\s*:\s*(.+?)\s*;?', after_brace)
                if prop_match:
                    pn = prop_match.group(1)
                    pv = prop_match.group(2).rstrip(';').strip()
                    if pn in LAYOUT_PROPS:
                        if pn == 'display' and 'grid' not in pv and 'flex' not in pv:
                            pass
                        else:
                            results.append((i, current_selector, pn, pv, current_media))
            continue

        if '}' in stripped:
            for _ in range(close_braces):
                brace_depth -= 1
                if brace_depth == 0:
                    current_media = None
                    current_selector = None
                elif brace_depth == 1 and current_media:
                    current_selector = None
            continue

        prop_match = re.match(r'\s*([a-z-]+)\s*:\s*(.+?)\s*;?\s*$', stripped)
        if prop_match and current_selector:
            pn = prop_match.group(1)
            pv = prop_match.group(2).rstrip(';').strip()
            if pn in LAYOUT_PROPS:
                if pn == 'display' and 'grid' not in pv and 'flex' not in pv:
                    pass
                else:
                    results.append((i, current_selector, pn, pv, current_media))

    return results

def main():
    results = parse_css(CSS_FILE)

    # Build lookup: which (selector, prop) pairs have MQ overrides
    media_map = defaultdict(list)
    for line, sel, prop, val, mq in results:
        if mq is not None:
            media_map[(sel.strip(), prop)].append((line, val, mq))

    # Organize by section
    sections = defaultdict(list)
    for line, sel, prop, val, mq in results:
        section = classify_selector(sel)
        sections[section].append((line, sel, prop, val, mq))

    section_order = list(SECTIONS.keys()) + ['Other/Global']

    print("# CSS LAYOUT AUDIT REPORT — styles.css\n")
    print(f"**Total layout declarations found:** {len(results)}")
    print(f"**Base (no MQ):** {sum(1 for _,_,_,_,m in results if m is None)}")
    print(f"**Inside @media:** {sum(1 for _,_,_,_,m in results if m is not None)}\n")

    for section in section_order:
        items = sections.get(section, [])
        if not items:
            continue

        base_items = [(l,s,p,v) for l,s,p,v,m in items if m is None]
        mq_items = [(l,s,p,v,m) for l,s,p,v,m in items if m is not None]

        print(f"\n---\n## {section}\n")

        if base_items:
            print("### Base Declarations\n")
            print("| Line | Selector | Property | Value | MQ Override? |")
            print("|------|----------|----------|-------|--------------|")
            for line,sel,prop,val in base_items:
                key = (sel.strip(), prop)
                has_mq = "YES" if key in media_map else "NO"
                # Flag problems
                flag = ""
                if has_mq == "NO":
                    if prop == 'grid-template-columns':
                        if 'repeat(' in val:
                            cm = re.search(r'repeat\((\d+)', val)
                            if cm and int(cm.group(1)) > 1:
                                flag = " **NEEDS MQ**"
                        elif '1fr 1fr' in val or 'px' in val:
                            flag = " **NEEDS MQ**"
                    if prop in ('width','height','min-width','min-height','max-width'):
                        nm = re.search(r'(\d+)', val)
                        if nm and ('px' in val or 'rem' in val):
                            if int(nm.group(1)) > 200:
                                flag = " **NEEDS MQ**"
                    if prop in ('padding','padding-left','padding-right','gap') and 'px' in val:
                        nm = re.search(r'(\d+)', val)
                        if nm and int(nm.group(1)) > 40:
                            flag = " **NEEDS MQ**"

                print(f"| {line} | `{sel[:60]}` | `{prop}` | `{val[:50]}` | {has_mq}{flag} |")

        if mq_items:
            print("\n### Media Query Overrides\n")
            print("| Line | Selector | Property | Value | Media Query |")
            print("|------|----------|----------|-------|-------------|")
            for line,sel,prop,val,mq in mq_items:
                print(f"| {line} | `{sel[:50]}` | `{prop}` | `{val[:40]}` | `{mq[:45]}` |")

    # Critical problems summary
    print("\n\n---\n# CRITICAL ISSUES — Missing Responsive Overrides\n")
    print("These base declarations have NO `@media` overrides and may cause layout issues on mobile:\n")

    for section in section_order:
        items = sections.get(section, [])
        if not items:
            continue

        problems = []
        for line,sel,prop,val,mq in items:
            if mq is not None:
                continue
            key = (sel.strip(), prop)
            if key in media_map:
                continue

            reason = None

            if prop == 'grid-template-columns':
                if 'repeat(' in val:
                    cm = re.search(r'repeat\((\d+)', val)
                    if cm and int(cm.group(1)) > 1:
                        reason = f"Grid {cm.group(1)}-col, no mobile 1fr"
                    elif 'auto-fill' in val or 'auto-fit' in val:
                        reason = None  # These are already responsive
                elif '1fr 1fr' in val:
                    reason = "2-col grid, no mobile 1fr"
                elif 'px' in val:
                    reason = "Fixed-px grid columns"

            if prop in ('width', 'min-width') and ('px' in val or 'rem' in val):
                nm = re.search(r'(\d+)', val)
                if nm and int(nm.group(1)) > 300:
                    reason = f"Fixed {prop}: {val}"

            if prop == 'max-width' and 'px' in val:
                nm = re.search(r'(\d+)', val)
                if nm and int(nm.group(1)) > 800:
                    reason = f"Large max-width: {val}"

            if prop == 'height' and 'px' in val:
                nm = re.search(r'(\d+)', val)
                if nm and int(nm.group(1)) > 300:
                    reason = f"Fixed height: {val}"

            if prop in ('padding', 'gap'):
                if 'px' in val:
                    nm = re.search(r'(\d+)', val)
                    if nm and int(nm.group(1)) > 48:
                        reason = f"Large fixed {prop}: {val}"

            if reason:
                problems.append((line, sel, prop, val, reason))

        if problems:
            print(f"\n### {section}\n")
            print("| Line | Selector | Property | Value | Issue |")
            print("|------|----------|----------|-------|-------|")
            for line,sel,prop,val,reason in problems:
                print(f"| {line} | `{sel[:55]}` | `{prop}` | `{val[:45]}` | {reason} |")

if __name__ == '__main__':
    main()
