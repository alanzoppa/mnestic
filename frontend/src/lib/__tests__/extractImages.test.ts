import { describe, it, expect } from "vitest";
import { extractImages } from "@/app/notes/[id]/page";

describe("extractImages", () => {
  describe("mixed content", () => {
    it("returns correct text and image list", () => {
      const input = "Here is a photo: ![my image](image.png) and some text";
      const { content, images } = extractImages(input);
      expect(content).toBe("Here is a photo:  and some text");
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe("image.png");
      expect(images[0].alt).toBe("my image");
      expect(images[0].type).toBe("inline");
    });

    it("handles multiple images with surrounding text", () => {
      const input = "Before ![img1](a.png) middle ![img2](b.png) after";
      const { content, images } = extractImages(input);
      expect(content).toBe("Before  middle  after");
      expect(images).toHaveLength(2);
      expect(images[0].src).toBe("a.png");
      expect(images[1].src).toBe("b.png");
    });
  });

  describe("image-only body", () => {
    it("returns empty text and correct image count", () => {
      const input = "![photo](image.jpg)";
      const { content, images } = extractImages(input);
      expect(content.trim()).toBe("");
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe("image.jpg");
    });

    it("handles multiple images with no text", () => {
      const input = "![a](x.png)\n\n![b](y.png)\n\n![c](z.png)";
      const { content, images } = extractImages(input);
      expect(content.trim()).toBe("");
      expect(images).toHaveLength(3);
    });
  });

  describe("reference-style images", () => {
    it("extracts reference-style ![alt][ref] images", () => {
      const input = `Some text with ref image ![Alt text][myref]

[myref]: <data:image/png;base64,abc123>`;
      const { content, images } = extractImages(input);
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe("data:image/png;base64,abc123");
      expect(images[0].alt).toBe("Alt text");
      expect(images[0].type).toBe("inline");
    });

    it("handles multiple reference definitions", () => {
      const input = `![first](first_ref) and ![second](second_ref)

[first_ref]: <data:image/png;base64,FIRST>
[second_ref]: <data:image/png;base64,SECOND>`;
      const { content, images } = extractImages(input);
      expect(images).toHaveLength(2);
    });
  });

  describe("HTML img tags", () => {
    it("extracts HTML img tags", () => {
      const input = "Text before <img src=\"photo.jpg\" alt=\"test\"> text after";
      const { content, images } = extractImages(input);
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe("photo.jpg");
      expect(images[0].alt).toBe("test");
      expect(images[0].type).toBe("inline");
    });

    it("handles img tags without alt", () => {
      const input = "<img src=\"photo.jpg\">";
      const { content, images } = extractImages(input);
      expect(images).toHaveLength(1);
      expect(images[0].alt).toBeUndefined();
    });

    it("extracts img tags with single quotes", () => {
      const input = "<img src='image.png' alt='My Image'>";
      const { content, images } = extractImages(input);
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe("image.png");
      expect(images[0].alt).toBe("My Image");
    });
  });

  describe("edge cases", () => {
    it("handles [View original] links", () => {
      const input = "Check [View original](../images/photo.png) here";
      const { content, images } = extractImages(input);
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe("images/photo.png");
      expect(images[0].type).toBe("link");
      expect(images[0].alt).toBe("View original");
    });

    it("normalizes relative paths with ../", () => {
      const input = "![img](../images/photo.png)";
      const { images } = extractImages(input);
      expect(images[0].src).toBe("images/photo.png");
    });

    it("normalizes relative paths with ./", () => {
      const input = "![img](./images/photo.png)";
      const { images } = extractImages(input);
      expect(images[0].src).toBe("images/photo.png");
    });

    it("handles empty string input", () => {
      const { content, images } = extractImages("");
      expect(content).toBe("");
      expect(images).toHaveLength(0);
    });

    it("handles plain text with no images", () => {
      const input = "Just some plain text with no images at all.";
      const { content, images } = extractImages(input);
      expect(content).toBe(input);
      expect(images).toHaveLength(0);
    });
  });
});