# 韶关公交 PIDS 模拟屏

这是一个参考 [HKTSS/mtr-pids](https://github.com/HKTSS/mtr-pids) 视觉结构改造出来的韶关公交到站屏项目。

页面层继续沿用“顶部状态栏 + 提示页 + 四行到站信息 + 配置浮层”这套交互方式，但底层数据已经改成韶关公交车来了 H5 接口，并把线路和站点选择改成更适合公交场景的方式：

- 先选公交线路号
- 再选车站名
- 再选单方向、全部方向或双方向分屏

## 项目结构

- `index.html`
  前端入口，适合直接托管到 GitHub Pages。
- `assets/data/shaoguan-routes.json`
  线路静态清单，由脚本生成，负责驱动线路、站点、方向下拉。
- `assets/js/static/data.js`
  公交数据模型、清单读取、方向选项和界面提示配置。
- `assets/js/static/eta_api.js`
  实时数据入口，负责调用代理并转换成屏幕渲染所需的统一结构。
- `proxy/local-proxy.js`
  本地 Node 代理，适合开发和自测。
- `proxy/cloudflare-worker.js`
  Cloudflare Worker 版本代理，适合给 GitHub Pages 提供线上实时数据。
- `scripts/build-shaoguan-manifest.js`
  从车来了接口拉全量线路和站序，重新生成韶关线路清单。

## 为什么需要代理

车来了 H5 接口本身没有开放浏览器跨域头，所以：

- GitHub Pages 可以托管前端页面
- 但 GitHub Pages 里的浏览器代码不能直接请求 `web.chelaile.net.cn`

所以这个项目把实时链路拆成了两层：

1. GitHub Pages 托管静态页面和线路清单
2. 一个很薄的代理负责转发 `encryptedLineDetail`、补请求头、生成签名、解密返回体

页面配置里的“实时代理地址”填的就是这个代理服务根地址，前端会请求：

```text
<你的代理地址>/api/station-detail
```

## 本地运行

### 1. 启动静态页面

```bash
python -m http.server 4173
```

或任何你习惯的静态服务器都可以。

### 2. 启动本地代理

```bash
node proxy/local-proxy.js
```

默认监听：

```text
http://127.0.0.1:8787
```

页面里把“实时代理地址”填成上面这个地址即可。

### 3. 重新生成韶关线路清单

当你怀疑线路、站点、站序发生变化时，可以重新跑：

```bash
node scripts/build-shaoguan-manifest.js
```

脚本会更新：

```text
assets/data/shaoguan-routes.json
```

设计思路很直接：

- 先拿韶关全量线路
- 再按线路方向拉完整站序
- 最后把“接口原始线路名”和“界面展示线路号”拆开保存

这样像 `101（马坝⇔梅村）` 这类线路，界面还能按 `101` 统一归类，不会把方向说明混进线路下拉里。

## 部署到 GitHub Pages

仓库已经附带 GitHub Pages 工作流：

- 推送到 `main` 分支后自动部署静态页面
- 页面内容直接来自仓库根目录

首次启用时只要在 GitHub 仓库设置里打开 Pages，并选择 `GitHub Actions` 作为来源。

## 部署线上代理

### 方案 A：Cloudflare Worker

把 `proxy/cloudflare-worker.js` 部署成 Worker，然后把页面里的“实时代理地址”填成 Worker 域名。

这个 Worker 做的事情只有三件：

- 接收前端传来的线路、方向、站点参数
- 生成 `cryptoSign`
- 请求车来了接口并解密 `encryptResult`

如果你用 Wrangler，记得开启 Node 兼容模式，因为代理里用了 `node:crypto` 来处理 `MD5` 和 `AES-256-ECB`。

可以参考下面这个最小配置：

```toml
name = "shaoguan-bus-pids-proxy"
main = "cloudflare-worker.js"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
```

### 方案 B：自托管 Node 代理

如果你有自己的服务器，也可以直接跑：

```bash
node proxy/local-proxy.js
```

然后把这个服务挂到公网。

## 代理接口说明

如果你准备把代理单独开放成接口服务，建议至少保留下面 3 个路由。

### `GET /api/health`

用途：

- 健康检查
- 给前端确认代理是否在线

示例：

```text
GET /api/health
```

返回示例：

```json
{
  "ok": true,
  "now": "2026-03-22T09:06:19.435Z"
}
```

### `GET /api/station-detail`

这是当前前端实时查询的主接口，优先使用。

请求参数：

- `stationId`：必填，车站 ID，例如 `0751-24`
- `destSId`：可选，默认 `-1`
- `cityId`：可选，默认 `241`
- `src`：可选，默认 `wechat_shaoguan`

示例：

```text
GET /api/station-detail?stationId=0751-24&cityId=241&src=wechat_shaoguan
```

返回要点：

- 原始车来了 `encryptedStnDetail` 解密后的 JSON
- `lines[].line`：线路和方向基础信息
- `lines[].targetStation`：当前站在该方向下的站序
- `lines[].nextStation`：下一站
- `lines[].stnStates[]`：多班车到站信息

其中最关键的是 `stnStates[]`：

- `value`：分钟数
- `travelTime`：秒
- `arrivalTime`：预计到站时间戳
- `busId`：车辆标识

### `GET /api/line-detail`

这是备用接口，当前前端只在站点接口拿不到 `stnStates` 时才回退调用。

请求参数：

- `lineId`：必填
- `lineName`：必填
- `direction`：必填
- `stationName`：必填
- `nextStationName`：必填
- `lineNo`：必填
- `targetOrder`：必填
- `cityId`：可选，默认 `241`
- `src`：可选，默认 `wechat_shaoguan`

示例：

```text
GET /api/line-detail?lineId=0751131909628&lineName=7&direction=1&stationName=市一中&nextStationName=府管&lineNo=7&targetOrder=8
```

返回要点：

- 原始车来了 `encryptedLineDetail` 解密后的 JSON
- `buses[]`：车辆位置和状态
- `line`：线路信息
- `stations[]`：完整站序

建议对外说明：

- `/api/station-detail` 是推荐查询入口
- `/api/line-detail` 是高级/回退入口
- 代理只做转发、签名和解密，不对业务字段二次包装

## 界面和数据设计说明

这次改造没有硬把“公交边角场景”打补丁塞进原来的列车逻辑里，而是把几个关键点重新抽象了：

- 线路清单不再写死在前端，而是用生成脚本落成静态 JSON
- 方向不再固定写成 `UP/DOWN`，而是按当前线路和车站动态生成“开往某终点 / 全部方向 / 双方向分屏”
- 实时数据不再依赖线路全表查询，而是直接吃预生成的 `lineId + targetOrder + nextStationName`

这样做的好处很实际：

- 线路和站点选择会更快
- 前端结构仍然能保持和参考项目接近
- 接口变化时只需要重新生成清单或替换代理逻辑，不用整页重写

## 致谢与许可

本项目前端壳体、屏幕布局思路和部分静态资源参考了：

- [HKTSS/mtr-pids](https://github.com/HKTSS/mtr-pids)

原参考项目使用 Apache License 2.0，本仓库保留其许可证文件以便继续遵循原始开源许可要求。
