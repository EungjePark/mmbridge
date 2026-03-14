import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

export interface SidebarItem {
  label: string;
  badge?: string;
  badgeColor?: string;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  sections: SidebarSection[];
  selectedIndex: number;
  focused: boolean;
  onSelect: (index: number) => void;
}

export function Sidebar({
  sections,
  selectedIndex,
  focused,
}: SidebarProps): React.ReactElement {
  // Build flat list of all items with global indices
  const flatItems: Array<{
    sectionTitle: string;
    sectionIndex: number;
    item: SidebarItem;
    globalIndex: number;
  }> = [];
  sections.forEach((section, si) => {
    section.items.forEach((item) => {
      flatItems.push({
        sectionTitle: section.title,
        sectionIndex: si,
        item,
        globalIndex: flatItems.length,
      });
    });
  });

  return (
    <Box
      flexDirection="column"
      width={24}
      paddingX={focused ? 0 : 1}
      paddingY={0}
    >
      {focused && (
        // Left focus indicator strip
        <Box position="absolute" height={100}>
          <Text color={colors.green}>{'▎'}</Text>
        </Box>
      )}
      {sections.map((section, si) => {
        const sectionItems = flatItems.filter((f) => f.sectionIndex === si);
        return (
          <Box key={section.title} flexDirection="column" marginTop={si > 0 ? 1 : 0}>
            <Box paddingLeft={focused ? 1 : 0}>
              <Text color={colors.textMuted}>
                {section.title.toUpperCase()}
              </Text>
            </Box>
            <Box marginTop={0} flexDirection="column">
              {sectionItems.map(({ item, globalIndex }) => {
                const isSelected = globalIndex === selectedIndex;
                return (
                  <Box
                    key={`${section.title}-${item.label}`}
                    flexDirection="row"
                    paddingLeft={focused ? 1 : 0}
                  >
                    <Text color={isSelected ? colors.green : colors.textMuted}>
                      {'   '}
                      {isSelected ? '\u25CF' : '\u25CB'}
                      {' '}
                    </Text>
                    <Text
                      color={isSelected ? colors.text : colors.textMuted}
                      bold={isSelected}
                    >
                      {item.label}
                    </Text>
                    {item.badge !== undefined && item.badge !== '' && (
                      <Text color={item.badgeColor ?? colors.textMuted}>
                        {'  '}
                        {item.badge}
                      </Text>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
