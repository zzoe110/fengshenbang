#!/usr/bin/env bash
# scripts/push.sh
# 仓库推送脚本：优先直连 GitHub（绕过代理），直连失败自动切回本地代理。
# 遇到远端更新会自动 git pull --rebase 再推送。
# 用法：./scripts/push.sh [branch]  （默认 main）
# 退出码：0 推送成功；1 全部失败

BRANCH="${1:-main}"

# 提取当前已定义的代理环境变量名
PROXY_VARS=()
for v in HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy; do
  if [ -n "${!v+x}" ]; then PROXY_VARS+=("$v"); fi
done

# 生成 env -u 参数串（每个 -u 独立）
build_unset_args() {
  local args=""
  for v in "${PROXY_VARS[@]}"; do args+="-u $v "; done
  echo "$args"
}

# 直连推送：env -u 清理代理后 push；远端更新则 pull --rebase 再推
try_direct() {
  echo "[push] 尝试直连 GitHub（branch=${BRANCH}）..."
  local unset_args; unset_args=$(build_unset_args)
  eval "env $unset_args git push origin '${BRANCH}'" 2>&1 || {
    if git status -sb | grep -q "ahead"; then
      echo "[push] 远端有更新，自动 rebase 后重试..."
      eval "env $unset_args git pull --rebase origin '${BRANCH}'" >/dev/null 2>&1
      eval "env $unset_args git push origin '${BRANCH}'"
    else
      return 1
    fi
  }
}

# 代理推送：用现有环境代理
try_proxy() {
  echo "[push] 直连失败，切回本地代理重试（branch=${BRANCH}）..."
  if [ ${#PROXY_VARS[@]} -eq 0 ]; then
    echo "[push] 当前无代理环境变量，无法切回"
    return 1
  fi
  git push origin "${BRANCH}" 2>&1 || {
    if git status -sb | grep -q "ahead"; then
      echo "[push] 远端有更新，自动 rebase 后重试..."
      git pull --rebase origin "${BRANCH}" >/dev/null 2>&1
      git push origin "${BRANCH}"
    else
      return 1
    fi
  }
}

for i in 1 2 3; do
  if try_direct 2>&1; then echo "✅ 直连推送成功"; exit 0; fi
  echo "[push] 直连第${i}次失败"
  sleep 2
done

for i in 1 2 3; do
  if try_proxy 2>&1; then echo "✅ 代理推送成功"; exit 0; fi
  echo "[push] 代理第${i}次失败"
  sleep 2
done

echo "❌ 直连与代理均失败，请检查网络或仓库权限"
exit 1
