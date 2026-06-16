import { Mail } from "lucide-react";
import type { BlockDefinition } from "@/lib/registry-types";
import { FormBlock } from "./form";

export const formBlocks: BlockDefinition[] = [
  {
    type: "form",
    label: "Form",
    icon: Mail,
    category: "Sections",
    description: "Contact form with submissions inbox",
    defaultProps: {
      title: "Get in touch",
      description: "We'll get back to you within one business day.",
      submitText: "Send message",
      successMessage: "Thanks! Your message has been sent.",
      formId: "contact",
      fields: [
        { label: "Name", type: "text", required: true },
        { label: "Email", type: "email", required: true },
        { label: "Message", type: "textarea", required: false },
      ],
    },
    defaultStyles: { desktop: { backgroundColor: "#ffffff" } },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "fields",
        label: "Form fields",
        type: "items",
        itemFields: [
          { key: "label", label: "Label", type: "text" },
          {
            key: "type",
            label: "Type",
            type: "select",
            options: [
              { label: "Text", value: "text" },
              { label: "Email", value: "email" },
              { label: "Phone", value: "tel" },
              { label: "Number", value: "number" },
              { label: "Textarea", value: "textarea" },
            ],
          },
          { key: "required", label: "Required", type: "boolean" },
        ],
      },
      { key: "submitText", label: "Button text", type: "text" },
      { key: "successMessage", label: "Success message", type: "textarea" },
    ],
    styleGroups: ["background", "spacing"],
    Render: FormBlock,
  },
];
