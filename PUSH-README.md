# GitHub 提交准备说明

本目录是最新整合版的独立仓库副本，网站文件直接位于仓库根目录。HTML/CSS/JS 就是维护源文件，无需 npm install 或构建。不要用旧 site-source 重建。

## 当前状态

- 基线提交：35348ae3798ff2518227922a44c5c327306b8893。
- 当前分支：website-upgrade-20261027。
- origin：https://github.com/zzirui321-rgb/Life-Group-Web.git。
- 最新升级及交付文档保留在工作区，尚未暂存、提交或推送。
- Git 历史为原本地仓库的完整可达历史，未执行 fetch；提交前需确认远端最新状态。
- 原始工作目录 Life-Group-Web-Claude 保持不变。后续若继续修改原目录，需要重新同步本交付副本。

## 内容索引

| 文件 | 用途 |
| --- | --- |
| UPGRADE-CHECKLIST.md | 截至本版的逐项升级清单 |
| CHANGELOG.md | 每轮修改及最终替代关系 |
| VALIDATION.json | 本次交付检查结果 |
| RELEASE-MANIFEST.json | 网站文件的 SHA-256 清单 |
| scripts/verify.cjs | 可重复运行的验证入口 |
| ai4s.html、en/ai4s.html | AI4S × S4AI 专题 |

交付包没有 PINED-Net 原始 DOCX、私密提取文本、未公开参数与训练结果，也没有方案服务、备份、临时截图或废弃 Motion-Preview。公开概念图位于 images/ai4s/。

## 本地查看

在本目录打开终端，执行：

```powershell
python -m http.server 8775 --bind 127.0.0.1
```

浏览器打开 http://127.0.0.1:8775/ 或 http://127.0.0.1:8775/ai4s.html#dmd-overview。按 Ctrl+C 停止。不要直接双击 HTML，网站使用根目录相对资源路径。原工作目录的既有预览仍使用 8773，二者是不同副本。

## 提交前检查

```powershell
node scripts/verify.cjs
git status --short
git diff --stat
git diff --check
```

verify 会复核网站文件哈希、原有本地链接/专题/论文关联/数值检查、根目录 JavaScript 语法及 diff 空白。编辑网站后需有意识地更新 RELEASE-MANIFEST.json，否则哈希检查会提醒交付内容已经变化。

## 后续提交与推送

以下命令只是操作说明，本次没有执行。准备发布到 GitHub 时，先确认 origin 和分支，并获取远端状态：

```powershell
git remote -v
git branch --show-current
git fetch origin
git log --oneline --left-right origin/main...HEAD
```

如远端 main 比本地基线更新，先审阅差异并在提交后处理合并；不要强制覆盖。确认工作区内容后：

```powershell
git add --all
git diff --cached --stat
git diff --cached --check
git commit -m "Add AI4S and S4AI topic and refine scientific interactions"
git push -u origin website-upgrade-20261027
```

此路径推送独立分支，随后可审阅 PR。现有 README 记录 main 用于 GitHub Pages，合并 main 可能触发正式网站更新；仍需遵循暂不上线的要求。不要直接执行向 main 的 push。

## 验证范围

VALIDATION.json 记录本交付副本的自动检查。此前浏览器检查覆盖主要中英文页面、1400px 桌面、390px 手机、DMD 累积展开和科研组件关键操作；没有重新做全站全交互回归，也未测试硬件触摸及系统减少动态效果设置。外部论文链接不在本次联网重检范围。

## 2026-10-27 提交前复核

以上状态描述的是交付包生成时点。本次已 fetch，origin/main 与基线 35348ae 一致；自动检查、JavaScript 定向审查和浏览器抽查通过，未发现阻断问题。浏览器覆盖与限制见 VALIDATION.json。本次提交目标为 website-upgrade-20261027，正式站点 main 不变；最终提交与推送状态以 Git 历史及远端分支为准。
