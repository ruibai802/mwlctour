// 规则编辑器内嵌图片扩展（自定义实现，等价于 @tiptap/extension-image 的核心能力）
// 支持 src / alt / title / width 属性，渲染为 <img>，规则展示页可直接显示
import { Node, mergeAttributes } from '@tiptap/core'

export const Image = Node.create({
  name: 'image',

  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  inline: false,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('width'),
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {})
      }
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs: options })
        },
      updateImage:
        (attrs) =>
        ({ commands }) => {
          return commands.updateAttributes('image', attrs)
        }
    }
  }
})

export default Image
