// ============================================
// 烽审榜 - 安全模块
// 1. 密码哈希（PBKDF2）
// 2. 数据加密（AES-GCM）
// 3. XSS 转义
// 4. 操作审计日志
// 5. 登录限流
// ============================================

const Security = {

  // ============================================
  // 1. 密码哈希（Web Crypto API - PBKDF2）
  // ============================================
  async hashPassword(password, salt = null) {
    if (!salt) {
      salt = crypto.getRandomValues(new Uint8Array(16));
    }
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return {
      hash: this.arrayToBase64(new Uint8Array(derivedBits)),
      salt: this.arrayToBase64(salt)
    };
  },

  async verifyPassword(password, hash, saltB64) {
    const salt = this.base64ToArray(saltB64);
    const { hash: newHash } = await this.hashPassword(password, salt);
    return newHash === hash;
  },

  // ============================================
  // 2. 数据加密（AES-GCM）
  // ============================================
  async getOrCreateMasterKey() {
    let keyB64 = localStorage.getItem('fsb_master_key');
    if (!keyB64) {
      const key = crypto.getRandomValues(new Uint8Array(32));
      keyB64 = this.arrayToBase64(key);
      localStorage.setItem('fsb_master_key', keyB64);
    }
    const rawKey = this.base64ToArray(keyB64);
    return crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
  },

  async encryptData(data) {
    try {
      const key = await this.getOrCreateMasterKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const encoded = enc.encode(JSON.stringify(data));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

      return {
        iv: this.arrayToBase64(iv),
        ct: this.arrayToBase64(new Uint8Array(ciphertext)),
        v: 1
      };
    } catch (e) {
      console.error('加密失败', e);
      return data; // 降级：返回原数据
    }
  },

  async decryptData(payload) {
    if (!payload || typeof payload !== 'object' || !payload.iv || !payload.ct) {
      // 不是加密格式（兼容旧数据）
      return payload;
    }
    try {
      const key = await this.getOrCreateMasterKey();
      const iv = this.base64ToArray(payload.iv);
      const ct = this.base64ToArray(payload.ct);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      console.error('解密失败', e);
      return null;
    }
  },

  // ============================================
  // 3. XSS 转义
  // ============================================
  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  // 安全插入HTML（用于富文本字段）
  sanitizeHTML(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  },

  // ============================================
  // 4. 操作审计日志
  // ============================================
  KEY_AUDIT_LOG: 'fsb_audit_log',

  log(action, details = {}) {
    try {
      const logs = JSON.parse(localStorage.getItem(this.KEY_AUDIT_LOG) || '[]');
      logs.unshift({
        timestamp: new Date().toISOString(),
        action,
        user: sessionStorage.getItem('fsb_admin_user') || 'anonymous',
        userAgent: navigator.userAgent.substring(0, 100),
        details
      });
      // 只保留最近200条
      if (logs.length > 200) logs.length = 200;
      localStorage.setItem(this.KEY_AUDIT_LOG, JSON.stringify(logs));
    } catch (e) {
      console.warn('审计日志写入失败', e);
    }
  },

  getLogs() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY_AUDIT_LOG) || '[]');
    } catch {
      return [];
    }
  },

  // ============================================
  // 5. 登录限流（防暴力破解）
  // ============================================
  KEY_LOGIN_ATTEMPTS: 'fsb_login_attempts',
  MAX_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 15,

  checkLoginLockout() {
    try {
      const data = JSON.parse(localStorage.getItem(this.KEY_LOGIN_ATTEMPTS) || '{}');
      if (data.lockUntil && Date.now() < data.lockUntil) {
        const remain = Math.ceil((data.lockUntil - Date.now()) / 60000);
        return { locked: true, remain };
      }
      return { locked: false, attempts: data.attempts || 0 };
    } catch {
      return { locked: false, attempts: 0 };
    }
  },

  recordLoginAttempt(success) {
    try {
      if (success) {
        localStorage.removeItem(this.KEY_LOGIN_ATTEMPTS);
        return;
      }
      const data = JSON.parse(localStorage.getItem(this.KEY_LOGIN_ATTEMPTS) || '{}');
      data.attempts = (data.attempts || 0) + 1;
      if (data.attempts >= this.MAX_ATTEMPTS) {
        data.lockUntil = Date.now() + this.LOCKOUT_MINUTES * 60 * 1000;
      }
      localStorage.setItem(this.KEY_LOGIN_ATTEMPTS, JSON.stringify(data));
    } catch (e) {
      console.warn('记录登录失败', e);
    }
  },

  // ============================================
  // 工具方法：Array <-> Base64
  // ============================================
  arrayToBase64(arr) {
    return btoa(String.fromCharCode.apply(null, arr));
  },

  base64ToArray(b64) {
    const binary = atob(b64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      arr[i] = binary.charCodeAt(i);
    }
    return arr;
  },

  // ============================================
  // 初始化默认账号（首次运行时生成哈希）
  // ============================================
  async initDefaultCredentials() {
    const stored = localStorage.getItem('fsb_credentials');
    if (stored) return; // 已初始化

    const defaultUser = 'admin';
    const defaultPass = 'admin' + Math.random().toString(36).slice(-6) + '!';

    const { hash, salt } = await this.hashPassword(defaultPass);
    localStorage.setItem('fsb_credentials', JSON.stringify({
      username: defaultUser,
      hash,
      salt,
      createdAt: new Date().toISOString()
    }));

    // 把随机密码打印到控制台（仅首次）
    console.log('%c🔐 烽审榜 CMS 首次初始化', 'color:#d4af6a;font-size:14px;font-weight:bold;');
    console.log('%c账号: ' + defaultUser, 'color:#b8924a;font-size:13px;');
    console.log('%c密码: ' + defaultPass, 'color:#b8924a;font-size:13px;font-weight:bold;');
    console.log('%c⚠️ 请立即登录后修改默认密码！', 'color:#f44336;font-size:12px;');
    console.log('%c（此密码仅显示一次，刷新后无法查看）', 'color:#707070;font-size:11px;');

    // 提示用户
    const tip = document.createElement('div');
    tip.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid #d4af6a;color:#e8c896;padding:1rem 1.5rem;border-radius:8px;z-index:99999;font-family:monospace;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,0.5);max-width:90%;';
    tip.innerHTML = `<div style="font-weight:bold;margin-bottom:0.5rem;">🔐 安全初始化</div>
      <div>账号: <strong style="color:#fff;">${defaultUser}</strong></div>
      <div>密码: <strong style="color:#fff;">${defaultPass}</strong></div>
      <div style="color:#f44336;margin-top:0.5rem;font-size:11px;">⚠️ 请立即保存并修改！</div>`;
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 15000);
  }
};

// 暴露到全局
window.Security = Security;
