import React from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { sanitizeRichText } from '@/lib/richTextSanitizer';

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{'list': 'ordered'}, {'list': 'bullet'}],
    ['link', 'image'],
    ['clean']
  ],
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet',
  'link', 'image'
];

const RichTextEditor = ({ value, onChange }) => {
  const safeValue = sanitizeRichText(value);

  return (
    <div className="bg-background">
        <ReactQuill
            theme="snow"
            value={safeValue}
            onChange={(html) => onChange(sanitizeRichText(html))}
            modules={modules}
            formats={formats}
        />
    </div>
  );
};

export default RichTextEditor;
