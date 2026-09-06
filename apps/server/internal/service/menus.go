package service

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"github.com/cms-template/server/internal/repo"
	"github.com/cms-template/server/internal/types"
)

// 菜单模块业务错误。
var (
	ErrMenuPathExists  = errors.New("menu path exists")
	ErrMenuHasChildren = errors.New("menu has children")
)

// MenuService 菜单管理业务。
type MenuService struct {
	db *gorm.DB
}

// NewMenuService 装配 MenuService。
func NewMenuService(db *gorm.DB) *MenuService {
	return &MenuService{db: db}
}

// List 管理端全量菜单树(含隐藏项)。
func (s *MenuService) List(ctx context.Context) ([]types.MenuItem, error) {
	menus, err := repo.ListMenus(ctx, s.db)
	if err != nil {
		return nil, err
	}
	return s.buildAdminTree(ctx, menus), nil
}

// Create 新建菜单;路径唯一;绑定的权限码 upsert 为 menu 权限点。
func (s *MenuService) Create(ctx context.Context, req types.MenuUpsert) (types.MenuItem, error) {
	if _, err := repo.GetMenuByPath(ctx, s.db, req.Path); err == nil {
		return types.MenuItem{}, ErrMenuPathExists
	} else if !errors.Is(err, repo.ErrMenuNotFound) {
		return types.MenuItem{}, err
	}

	permissionID, err := s.resolvePermissionID(ctx, req.ParentID, req.PermissionCode, req.Name)
	if err != nil {
		return types.MenuItem{}, err
	}

	menu := repo.Menu{
		ParentID:     req.ParentID,
		Name:         req.Name,
		Path:         req.Path,
		ComponentKey: req.ComponentKey,
		Icon:         req.Icon,
		PermissionID: permissionID,
		Sort:         req.Sort,
		Visible:      req.Visible,
	}
	if err := repo.CreateMenu(ctx, s.db, &menu); err != nil {
		return types.MenuItem{}, err
	}
	return s.toMenuItem(ctx, menu)
}

// Update 编辑菜单;路径唯一;权限码变更时联动权限点。
func (s *MenuService) Update(ctx context.Context, id int64, req types.MenuUpsert) (types.MenuItem, error) {
	menu, err := repo.GetMenuByID(ctx, s.db, id)
	if err != nil {
		return types.MenuItem{}, err
	}
	if conflict, err := repo.GetMenuByPath(ctx, s.db, req.Path); err == nil && conflict.ID != id {
		return types.MenuItem{}, ErrMenuPathExists
	} else if err != nil && !errors.Is(err, repo.ErrMenuNotFound) {
		return types.MenuItem{}, err
	}

	permissionID, err := s.resolvePermissionID(ctx, req.ParentID, req.PermissionCode, req.Name)
	if err != nil {
		return types.MenuItem{}, err
	}

	menu.ParentID = req.ParentID
	menu.Name = req.Name
	menu.Path = req.Path
	menu.ComponentKey = req.ComponentKey
	menu.Icon = req.Icon
	menu.PermissionID = permissionID
	menu.Sort = req.Sort
	menu.Visible = req.Visible
	if err := repo.UpdateMenu(ctx, s.db, &menu); err != nil {
		return types.MenuItem{}, err
	}
	return s.toMenuItem(ctx, menu)
}

// Delete 删除菜单:有子菜单拒绝;联动删除绑定的菜单权限点。
func (s *MenuService) Delete(ctx context.Context, id int64) error {
	menu, err := repo.GetMenuByID(ctx, s.db, id)
	if err != nil {
		return err
	}
	if children, err := repo.HasMenuChildren(ctx, s.db, id); err != nil {
		return err
	} else if children {
		return ErrMenuHasChildren
	}
	return repo.DeleteMenu(ctx, s.db, menu)
}

// AuthMenus 当前用户可见菜单树:按权限码过滤,排除隐藏项,空目录不出现在侧边栏。
func (s *MenuService) AuthMenus(ctx context.Context, userID int64) ([]types.AuthMenuNode, error) {
	menus, err := repo.ListMenus(ctx, s.db)
	if err != nil {
		return nil, err
	}
	userCodes, err := repo.ListPermissionCodesByUserID(ctx, s.db, userID)
	if err != nil {
		return nil, err
	}
	userCodeSet := make(map[string]bool, len(userCodes))
	for _, code := range userCodes {
		userCodeSet[code] = true
	}

	// 先判每个菜单是否对当前用户可见(未绑定权限码 = 登录即可见;绑定则要求权限码)。
	allowed := make(map[int64]bool, len(menus))
	for _, menu := range menus {
		if !menu.Visible {
			continue
		}
		if menu.PermissionID == 0 {
			allowed[menu.ID] = true
			continue
		}
		code, err := repo.GetPermissionCode(ctx, s.db, menu.PermissionID)
		if err != nil {
			return nil, err
		}
		if code == "" || userCodeSet[code] {
			allowed[menu.ID] = true
		}
	}

	// 组树:目录节点仅在自身或后代可见时保留。
	// 先在指针上挂 children,最后统一拷贝为值,避免根节点在挂载前被值拷贝导致子树丢失。
	nodes := make(map[int64]*types.AuthMenuNode, len(menus))
	var rootPtrs []*types.AuthMenuNode
	for _, menu := range menus {
		if !allowed[menu.ID] {
			continue
		}
		nodes[menu.ID] = &types.AuthMenuNode{
			ID: menu.ID, ParentID: menu.ParentID, Name: menu.Name, Path: menu.Path,
			ComponentKey: menu.ComponentKey, Icon: menu.Icon, Sort: menu.Sort,
		}
	}
	for _, menu := range menus {
		if !allowed[menu.ID] {
			continue
		}
		node := nodes[menu.ID]
		if parent, ok := nodes[menu.ParentID]; ok && menu.ParentID != 0 {
			parent.Children = append(parent.Children, *node)
		} else {
			rootPtrs = append(rootPtrs, node)
		}
	}
	roots := make([]types.AuthMenuNode, 0, len(rootPtrs))
	for _, ptr := range rootPtrs {
		roots = append(roots, *ptr)
	}
	// 递归剔除无页面的空目录(避免空 SubMenu 出现在侧边栏)。
	return pruneEmptyDirs(roots), nil
}

func pruneEmptyDirs(nodes []types.AuthMenuNode) []types.AuthMenuNode {
	result := make([]types.AuthMenuNode, 0, len(nodes))
	for _, node := range nodes {
		node.Children = pruneEmptyDirs(node.Children)
		if node.ComponentKey == "" && len(node.Children) == 0 {
			continue
		}
		result = append(result, node)
	}
	if len(result) == 0 {
		return []types.AuthMenuNode{}
	}
	return result
}

// resolvePermissionID 绑定了权限码时 upsert menu 权限点(挂在父菜单的权限点之下)。
func (s *MenuService) resolvePermissionID(ctx context.Context, parentID int64, permissionCode, name string) (int64, error) {
	if permissionCode == "" {
		return 0, nil
	}
	parentPermissionID := int64(0)
	if parentID != 0 {
		parent, err := repo.GetMenuByID(ctx, s.db, parentID)
		if err != nil {
			return 0, err
		}
		parentPermissionID = parent.PermissionID
	}
	return repo.UpsertPermission(ctx, s.db, &repo.Permission{
		Code:     permissionCode,
		Name:     name,
		Type:     "menu",
		ParentID: parentPermissionID,
	})
}

func (s *MenuService) buildAdminTree(ctx context.Context, menus []repo.Menu) []types.MenuItem {
	byParent := make(map[int64][]repo.Menu, len(menus))
	codes := make(map[int64]string, len(menus))
	for _, menu := range menus {
		byParent[menu.ParentID] = append(byParent[menu.ParentID], menu)
		codes[menu.ID], _ = repo.GetPermissionCode(ctx, s.db, menu.PermissionID)
	}

	var build func(parentID int64) []types.MenuItem
	build = func(parentID int64) []types.MenuItem {
		items := make([]types.MenuItem, 0)
		for _, menu := range byParent[parentID] {
			item := types.MenuItem{
				ID:             menu.ID,
				ParentID:       menu.ParentID,
				Name:           menu.Name,
				Path:           menu.Path,
				ComponentKey:   menu.ComponentKey,
				Icon:           menu.Icon,
				PermissionID:   menu.PermissionID,
				PermissionCode: codes[menu.ID],
				Sort:           menu.Sort,
				Visible:        menu.Visible,
			}
			item.Children = build(menu.ID)
			items = append(items, item)
		}
		return items
	}

	roots := build(0)
	if roots == nil {
		roots = []types.MenuItem{}
	}
	return roots
}

func (s *MenuService) toMenuItem(ctx context.Context, menu repo.Menu) (types.MenuItem, error) {
	code, err := repo.GetPermissionCode(ctx, s.db, menu.PermissionID)
	if err != nil {
		return types.MenuItem{}, err
	}
	return types.MenuItem{
		ID:             menu.ID,
		ParentID:       menu.ParentID,
		Name:           menu.Name,
		Path:           menu.Path,
		ComponentKey:   menu.ComponentKey,
		Icon:           menu.Icon,
		PermissionID:   menu.PermissionID,
		PermissionCode: code,
		Sort:           menu.Sort,
		Visible:        menu.Visible,
		Children:       []types.MenuItem{},
	}, nil
}
