# 城市公交 PIDS 模拟屏

这是一个参考 [HKTSS/mtr-pids](https://github.com/HKTSS/mtr-pids) 视觉结构改造出来的多城市公交到站屏项目。

页面层继续沿用“顶部状态栏 + 提示页 + 四行到站信息 + 配置浮层”这套交互方式，但数据层已经改成了车来了 H5 公交接口，并支持先选城市，再选线路、车站和方向。

当前内置城市：

- 韶关
- 北京
- 上海
- 广州
- 深圳

## 项目结构

- `index.html`
  前端入口，适合直接托管到 GitHub Pages。
- `assets/data/cities.json`
  城市注册表，维护 `slug / cityId / src / 天气坐标`。
- `assets/data/manifests/*.json`
  分城市线路清单，每个城市单独一份，前端按城市懒加载。
- `assets/js/static/data.js`
  城市清单读取、线路清单切换、站点顺序和方向选项逻辑。
- `assets/js/static/eta_api.js`
  实时数据入口，负责把当前城市的 `cityId`、`src` 和线路参数一起带给代理。
- `proxy/local-proxy.js`
  本地 Node 代理，适合开发和自测。
- `proxy/cloudflare-worker.js`
  Cloudflare Worker 版本代理，适合给 GitHub Pages 提供线上实时数据。
- `scripts/build-city-manifests.js`
  从车来了接口拉取多城市全量线路和站序，生成所有 manifest。
- `scripts/build-shaoguan-manifest.js`
  兼容旧命令的包装脚本，只重建韶关清单。

## 为什么需要代理

车来了 H5 接口本身没有开放浏览器跨域头，所以：

- GitHub Pages 可以托管前端页面
- 但 GitHub Pages 里的浏览器代码不能直接请求 `web.chelaile.net.cn`

所以这个项目把实时链路拆成了两层：

1. GitHub Pages 托管静态页面和分城市线路清单
2. 一个很薄的代理负责转发请求、生成 `cryptoSign`、解密 `encryptResult`

页面配置里的“实时代理地址”填的就是这个代理服务根地址。

## 本地运行

### 1. 启动静态页面

```bash
python -m http.server 4173
```

### 2. 启动本地代理

```bash
node proxy/local-proxy.js
```

默认监听：

```text
http://127.0.0.1:8788
```

页面里把“实时代理地址”填成上面这个地址即可。

### 3. 重新生成线路清单

重建全部城市：

```bash
node scripts/build-city-manifests.js
```

只重建某一个城市：

```bash
node scripts/build-city-manifests.js --city beijing
```

兼容旧命令，只重建韶关：

```bash
node scripts/build-shaoguan-manifest.js
```

生成结果会写到：

```text
assets/data/manifests/
```

## 城市配置方式

多城市支持不是把所有线路直接写死在前端，而是拆成两层配置：

1. `assets/data/cities.json`
   维护城市基础信息：
   - `slug`
   - `name`
   - `englishName`
   - `cityId`
   - `src`
   - `weather.latitude`
   - `weather.longitude`
2. `assets/data/manifests/<slug>.json`
   维护该城市的线路、方向、站序和站点 ID

这样后续要再加城市，只需要：

1. 在 `assets/data/cities.json` 里补一个城市项
2. 运行 `node scripts/build-city-manifests.js --city <slug>`

前端切换城市时会自动加载对应 manifest，不会一次性把 5 个城市的大清单都下载下来。

## 部署到 GitHub Pages

仓库已经附带 GitHub Pages 工作流：

- 推送到 `main` 分支后自动部署静态页面
- 页面内容直接来自仓库根目录

首次启用时只要在 GitHub 仓库设置里打开 Pages，并选择 `GitHub Actions` 作为来源。

## 部署线上代理

### 方案 A：Cloudflare Worker

把 `proxy/cloudflare-worker.js` 部署成 Worker，然后把页面里的“实时代理地址”填成 Worker 域名。

如果你用 Wrangler，记得开启 Node 兼容模式，因为代理里用了 `node:crypto` 处理 `MD5` 和 `AES-256-ECB`。

可参考这个最小配置：

```toml
name = "city-bus-pids-proxy"
main = "cloudflare-worker.js"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
```

### 方案 B：自托管 Node 代理

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
  "now": "2026-03-22T10:33:26.801Z"
}
```

### `GET /api/station-detail`

这是当前前端实时查询的主接口，优先使用。

请求参数：

- `stationId`：必填，车站 ID
- `destSId`：可选，默认 `-1`
- `cityId`：建议必填，车来了城市 ID
- `src`：建议必填，当前城市对应的来源标识

示例：

```text
GET /api/station-detail?stationId=010-1858&destSId=-1&cityId=027&src=wechat_shaoguan
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
- `cityId`：建议必填，车来了城市 ID
- `src`：建议必填，当前城市对应的来源标识

示例：

```text
GET /api/line-detail?lineId=010-26-0&lineName=26&direction=0&stationName=二里庄&nextStationName=二里庄北口&lineNo=26&targetOrder=1&cityId=027&src=wechat_shaoguan
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
- 多城市调用时，前端应明确传入 `cityId` 和 `src`，不要依赖代理默认值

## 界面和数据设计说明

这次改造没有硬把“公交边角场景”打补丁塞进原来的列车逻辑里，而是把几个关键点重新抽象了：

- 城市注册表和线路清单解耦
- 每个城市单独生成 manifest，前端按需加载
- 方向不再固定写成 `UP/DOWN`，而是按当前线路和车站动态生成“开往某终点 / 全部方向 / 双方向分屏”
- 实时数据优先走 `station-detail`，只有站点接口拿不到 `stnStates` 才回退 `line-detail`

这样做的好处很实际：

- 城市切换不会拖慢首屏
- 线路和站点选择仍然保持接近参考项目的操作习惯
- 后续新增城市时，不用重写前端结构，只要补城市配置和 manifest

## 致谢与许可

本项目前端壳体、屏幕布局思路和部分静态资源参考了：

- [HKTSS/mtr-pids](https://github.com/HKTSS/mtr-pids)

原参考项目使用 Apache License 2.0，本仓库保留其许可证文件以便继续遵循原始开源许可要求。
