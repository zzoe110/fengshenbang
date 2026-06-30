// ============================================
// 烽审榜 - 安全模块
// 1. 密码哈希（PBKDF2）
// 2. 数据加密（AES-GCM）
// 3. XSS 转义
// 4. 操作审计日志
// 5. 登录限流
// ============================================

// ============================================
// 硬编码凭据（仅开发者可修改）
// 账号: admin | 密码: zouyinde@1314
// PBKDF2-SHA256, 100000 iterations
// ============================================
const HARDCODED_CREDENTIALS = {
  username: 'admin',
  hash: 'fy96EZ5WXWbIDs/o4fwhQ6wqMeceGg5sXbLEi5qwqxE=',
  salt: 'BeQiHJtCIiX+bsQcIJQ53A=='
};

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
  // 初始化（纯前端版：仅设置加密密钥）
  // 密码验证直接使用 HARDCODED_CREDENTIALS
  // ============================================
  async initCredentials() {
    // 仅初始化加密密钥（如果需要）
    await this.getOrCreateMasterKey();
  }
};

// 暴露到全局
window.Security = Security;
