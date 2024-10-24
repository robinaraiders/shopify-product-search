import { getSelectedText, Detail, Icon, ActionPanel, Action } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch from "node-fetch";

// Constants
const API_KEY = "b8df64d5bca8bf155836c16e0df1ea85";
const API_PASSWORD = "ace1fb17d79ce0aa858ea630442d5b1c";
const STORE_NAME = "macro-mike";
const SHOPIFY_API_VERSION = "2024-01";

interface Product {
  id: string;
  title: string;
  image: {
    src: string;
  };
  variants: Array<{
    id: string;
    sku: string;
    inventory_item_id: string;
  }>;
}

interface InventoryLevel {
  available: number;
  inventory_item_id: string;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<{
    sku: string; 
    quantity: number;
    imageUrl: string;
    title: string;
  } | null>(null);

  const getStockStatus = (quantity: number) => {
    if (quantity <= 0) return { color: "#e74c3c", text: "Out of Stock", icon: Icon.XMarkCircle };
    if (quantity < 10) return { color: "#f39c12", text: "Low Stock", icon: Icon.ExclamationMark };
    return { color: "#2ecc71", text: "In Stock", icon: Icon.CheckCircle };
  };

  useEffect(() => {
    async function searchProduct(searchText: string) {
      try {
        // Modified URL to include API key and password as query parameters
        const productResponse = await fetch(
          `https://${API_KEY}:${API_PASSWORD}@${STORE_NAME}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=250`,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!productResponse.ok) {
          const errorText = await productResponse.text();
          console.error("API Error:", errorText);
          throw new Error(`API Error: ${productResponse.status}`);
        }

        const productData = await productResponse.json();
        
        // Find exact match in the returned products
        const matchingProduct = productData.products.find(
          (product: Product) => product.title === searchText
        );

        if (!matchingProduct) {
          setError("No matching product found");
          return;
        }

        const variant = matchingProduct.variants[0];
        
        // Modified URL for inventory request
        const inventoryResponse = await fetch(
          `https://${API_KEY}:${API_PASSWORD}@${STORE_NAME}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}`,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!inventoryResponse.ok) {
          throw new Error(`Inventory API Error: ${inventoryResponse.status}`);
        }

        const inventoryData = await inventoryResponse.json();
        const inventoryLevel = inventoryData.inventory_levels[0];

        setProductInfo({
          sku: variant.sku,
          quantity: inventoryLevel.available,
          imageUrl: matchingProduct.image?.src || "",
          title: matchingProduct.title
        });

      } catch (error) {
        console.error("Error details:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch product information");
      } finally {
        setIsLoading(false);
      }
    }

    async function init() {
      try {
        const text = await getSelectedText();
        if (text) {
          await searchProduct(text.trim());
        } else {
          setError("No text selected");
          setIsLoading(false);
        }
      } catch (error) {
        setError("Failed to get selected text");
        setIsLoading(false);
      }
    }

    init();
  }, []);

  if (isLoading) {
    return <Detail isLoading={true} />;
  }

  if (error) {
    return <Detail markdown={`# Error\n\n${error}`} />;
  }

  if (productInfo) {
    const stockStatus = getStockStatus(productInfo.quantity);

    return (
      <Detail
        markdown={`<img src="${productInfo.imageUrl}" width="300" />`}
        metadata={
          <Detail.Metadata>
            <Detail.Metadata.Label
              title="Product Title"
              text={productInfo.title}
            />
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="SKU"
              text={productInfo.sku}
              icon={Icon.Barcode}
            />
            <Detail.Metadata.Label
              title="Stock Level"
              text={`${productInfo.quantity}`}
              icon={stockStatus.icon}
            />
            <Detail.Metadata.TagList title="Status">
              <Detail.Metadata.TagList.Item
                text={stockStatus.text}
                color={stockStatus.color}
              />
            </Detail.Metadata.TagList>
          </Detail.Metadata>
        }
        actions={
          <ActionPanel>
            <Action.CopyToClipboard
              title="Copy SKU"
              content={productInfo.sku}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
          </ActionPanel>
        }
      />
    );
  }

  return <Detail markdown="No results found" />;
}
