// 小程序运行时没有"同源"概念,wx.request 只接受绝对地址,API 基地址固定指向 Go server。
// 开发期直连本机:http://localhost:18085;微信开发者工具需勾选
// 「详情 → 本地设置 → 不校验合法域名、web-view(业务域名)、TLS 版本以及 HTTPS 证书」才能访问。
// 生产期接入网关后改为正式域名(占坑期统一取开发地址)。
export const API_BASE_URL = "http://localhost:18085";
