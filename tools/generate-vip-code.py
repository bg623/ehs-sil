#!/usr/bin/env python3
"""
EHS-SIL VIP Activation Code Generator v1.0
用法: python3 generate-vip-code.py [月数]
默认生成12个月有效期的激活码

1. 生成随机激活码
2. 自动写入 js/auth.js 的 VIP_CODES 数组
3. 输出激活码信息给用户
"""

import re, random, string, sys, os
from datetime import datetime, timedelta

AUTH_JS = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'js', 'auth.js')

def generate_code(length=10):
    """Generate a random alphanumeric activation code"""
    chars = string.ascii_uppercase + string.digits
    # Exclude confusing chars: 0O, 1I, 8B
    chars = chars.translate(str.maketrans('', '', '0O1I8B'))
    code = 'EHS-' + ''.join(random.choices(chars, k=length))
    return code

def main():
    months = 12
    if len(sys.argv) > 1:
        try:
            months = int(sys.argv[1])
        except ValueError:
            print(f'用法: python3 {sys.argv[0]} [月数]')
            sys.exit(1)
    
    if months < 1 or months > 120:
        print('月数范围: 1-120')
        sys.exit(1)
    
    # Generate expiry date
    expires = (datetime.now() + timedelta(days=30 * months)).strftime('%Y-%m-%d')
    code = generate_code()
    
    # Read auth.js
    if not os.path.exists(AUTH_JS):
        print(f'错误: 找不到 {AUTH_JS}')
        sys.exit(1)
    
    with open(AUTH_JS, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the VIP_CODES array and add new entry
    # Look for the last { ... } entry before the ];
    pattern = r'(\s*\{[^}]+code:\s*\'EHS-[^\']+\'[^}]+\})'
    matches = list(re.finditer(pattern, content))
    
    if not matches:
        print('错误: 在 auth.js 中找不到 VIP_CODES 数组')
        sys.exit(1)
    
    last_match = matches[-1]
    insert_pos = last_match.end()
    
    new_entry = f',\n    {{ code: \'{code}\', label: \'VIP年卡({months}个月)\', expires: \'{expires}\' }}'
    
    new_content = content[:insert_pos] + new_entry + content[insert_pos:]
    
    with open(AUTH_JS, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print('=' * 50)
    print('  ✅ VIP 激活码已生成')
    print('=' * 50)
    print(f'')
    print(f'  激活码:     {code}')
    print(f'  有效期至:   {expires}')
    print(f'  有效期:     {months} 个月')
    print(f'  标签:       VIP年卡({months}个月)')
    print(f'')
    print(f'  已添加到:   {AUTH_JS}')
    print(f'')
    print(f'  ⚡ 部署后即可使用')
    print(f'  ⚡ 无需修改任何其他文件')
    print(f'')
    print('=' * 50)

if __name__ == '__main__':
    main()
