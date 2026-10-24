export const TREE_VIEWS = [
  'ancestor',
  'descendant',
  'hourglass',
  'relationship',
  'fan',
  'whole',
]

// Tree fork: the whole family at once, so that relatives see everybody
export const DEFAULT_TREE_VIEW = 'whole'

export function getTreeViewTabIndex(view) {
  const index = TREE_VIEWS.indexOf(view)
  if (index !== -1) {
    return index
  }
  return TREE_VIEWS.indexOf(DEFAULT_TREE_VIEW)
}

// The app path of the tree view showing `grampsId` in `chart`, without the
// person when there is none
export function treeViewPath(chart, grampsId) {
  return ['tree', chart, grampsId].filter(Boolean).join('/')
}
