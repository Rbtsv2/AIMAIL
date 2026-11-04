// src/renderer/src/features/compose/Editor.tsx
import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import ImageBase from '@tiptap/extension-image'

// conserve largeur/hauteur/style des images (signatures, logos)
const Image = ImageBase.extend({
  addAttributes() { return { ...this.parent?.(), width: { default: null }, height: { default: null }, style: { default: null } } }
})
import Placeholder from '@tiptap/extension-placeholder'

import { shrinkImage } from '@/lib/image'

const fileToDataUrl = (f: File): Promise<string> => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })

export function Editor({ html, onChange, onSelection, onReady, placeholder = 'Écrivez votre message' }: {
  html: string; onChange: (html: string, text: string) => void; onSelection?: (s: string) => void; onReady?: (e: TiptapEditor) => void; placeholder?: string
}) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false, autolink: true }), Image.configure({ inline: true, allowBase64: true }), Placeholder.configure({ placeholder })],
    content: html,
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
    onSelectionUpdate: ({ editor }) => { const { from, to } = editor.state.selection; onSelection?.(editor.state.doc.textBetween(from, to, '\n')) },
    editorProps: {
      handlePaste: (view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
        if (!files.length) return false
        void Promise.all(files.map((f) => fileToDataUrl(f).then(shrinkImage))).then((srcs) => srcs.forEach((src) => view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src })))))
        return true
      },
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'))
        if (!files.length) return false
        void Promise.all(files.map((f) => fileToDataUrl(f).then(shrinkImage))).then((srcs) => srcs.forEach((src) => view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src })))))
        return true
      }
    }
  })
  useEffect(() => { if (editor) onReady?.(editor) }, [editor])
  useEffect(() => { if (editor && html !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(html, false) }, [html, editor])
  return <div className="editor" onClick={() => editor?.commands.focus()}><EditorContent editor={editor} /></div>
}