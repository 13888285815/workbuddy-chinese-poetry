const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Failed to read ${filePath}:`, e.message);
    return null;
  }
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 1024 * 1024) {
      return `${(stats.size / (1024 * 1024)).toFixed(1)}MB`;
    }
    return `${Math.round(stats.size / 1024)}KB`;
  } catch (e) {
    return '?KB';
  }
}

function collectPoemsFromFiles(pattern, dir) {
  const files = fs.readdirSync(dir).filter(f => f.match(pattern));
  const allPoems = [];
  const fileMap = [];
  
  files.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || 0);
    const numB = parseInt(b.match(/\d+/)?.[0] || 0);
    return numA - numB;
  });
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const data = readJsonFile(filePath);
    if (!data || !Array.isArray(data)) return;
    
    data.forEach((item, idx) => {
      const globalIndex = allPoems.length;
      const title = item.title || item.rhythmic || '';
      const author = item.author || '';
      const content = Array.isArray(item.paragraphs) ? item.paragraphs.join('\n') : '';
      
      allPoems.push({
        title,
        author,
        content,
        fileIndex: fileMap.length,
        localIndex: idx
      });
    });
    
    fileMap.push({
      name: file,
      path: `data/${dir.split('/').pop()}/${file}`,
      count: data.length,
      offset: allPoems.length - data.length
    });
  });
  
  return { allPoems, fileMap };
}

function buildAuthorTree(poems, fileMap) {
  const authors = {};
  
  poems.forEach((poem, idx) => {
    const author = poem.author || '佚名';
    if (!authors[author]) {
      authors[author] = [];
    }
    authors[author].push({
      title: poem.title || `第${idx + 1}篇`,
      fileIndex: poem.fileIndex,
      localIndex: poem.localIndex,
      globalIndex: idx
    });
  });
  
  const children = [];
  
  Object.keys(authors).sort().forEach(author => {
    const poemItems = authors[author];
    const authorChildren = poemItems.map(item => {
      const fileInfo = fileMap[item.fileIndex];
      return {
        title: item.title,
        path: fileInfo.path,
        index: item.localIndex,
        icon: '📄',
        type: 'poem'
      };
    });
    
    children.push({
      label: author,
      children: authorChildren
    });
  });
  
  return children;
}

function buildShijingTree(filePath) {
  const data = readJsonFile(path.join(__dirname, filePath));
  if (!data || !Array.isArray(data)) return [];
  
  const chapters = {};
  data.forEach((item, idx) => {
    const chapter = item.chapter || 'unknown';
    const section = item.section || '';
    const key = chapter + (section ? `·${section}` : '');
    if (!chapters[key]) {
      chapters[key] = [];
    }
    chapters[key].push({
      title: item.title || '',
      index: idx
    });
  });
  
  const children = [];
  Object.keys(chapters).sort().forEach(key => {
    const sectionChildren = chapters[key].map(item => ({
      title: item.title,
      path: filePath,
      index: item.index,
      icon: '📄',
      type: 'poem'
    }));
    children.push({
      label: key,
      children: sectionChildren
    });
  });
  
  return children;
}

function buildLunyuTree(filePath) {
  const data = readJsonFile(path.join(__dirname, filePath));
  if (!data || !Array.isArray(data)) return [];
  
  const children = [];
  data.forEach((chapterItem, chapterIdx) => {
    const chapter = chapterItem.chapter || `第${chapterIdx + 1}篇`;
    const paraChildren = chapterItem.paragraphs.map((para, idx) => ({
      title: `${chapter}·${idx + 1}`,
      path: filePath,
      index: chapterIdx,
      paraIndex: idx,
      icon: '📄',
      type: 'poem'
    }));
    children.push({
      label: chapter,
      children: paraChildren
    });
  });
  
  return children;
}

function buildSimpleTree(filePath) {
  const data = readJsonFile(path.join(__dirname, filePath));
  if (!data) return [];
  
  if (Array.isArray(data)) {
    return data.map((item, idx) => ({
      title: item.title || item.rhythmic || item.chapter || `第${idx + 1}篇`,
      path: filePath,
      index: idx,
      author: item.author || '',
      icon: '📄',
      type: 'poem'
    }));
  }
  
  return [{
    title: data.title || data.chapter || '全文',
    path: filePath,
    index: 0,
    author: data.author || '',
    icon: '📄',
    type: 'poem'
  }];
}

function buildTree() {
  const tree = {
    name: '📚 意念诗词库',
    type: 'root',
    children: []
  };

  const tangDir = path.join(dataDir, '全唐诗');
  const tangFiles = fs.readdirSync(tangDir).filter(f => f.match(/^poet\.tang\.\d+\.json$/));
  const { allPoems: tangPoems, fileMap: tangFileMap } = collectPoemsFromFiles(/^poet\.tang\.\d+\.json$/, tangDir);
  
  const songDir = path.join(dataDir, '宋词');
  const songFiles = fs.readdirSync(songDir).filter(f => f.match(/^ci\.song\.\d+\.json$/));
  const { allPoems: songPoems, fileMap: songFileMap } = collectPoemsFromFiles(/^ci\.song\.\d+\.json$/, songDir);

  const yuanDir = path.join(dataDir, '元曲');
  const { allPoems: yuanPoems, fileMap: yuanFileMap } = collectPoemsFromFiles(/\.json$/, yuanDir);

  tree.children.push({
    label: '先秦经典',
    children: [
      {
        label: '诗经',
        children: [{
          title: '诗经全本',
          path: 'data/诗经/shijing.json',
          size: getFileSize(path.join(dataDir, '诗经/shijing.json')),
          icon: '📜',
          desc: '305篇 · 中国最早诗歌总集',
          children: buildShijingTree('data/诗经/shijing.json')
        }]
      },
      {
        label: '楚辞',
        children: [{
          title: '楚辞全本',
          path: 'data/楚辞/chuci.json',
          size: getFileSize(path.join(dataDir, '楚辞/chuci.json')),
          icon: '📜',
          desc: '屈原等 · 浪漫主义诗歌',
          children: buildSimpleTree('data/楚辞/chuci.json')
        }]
      }
    ]
  });

  tree.children.push({
    label: '四书五经',
    children: [
      {
        label: '论语',
        children: [{
          title: '论语全本',
          path: 'data/论语/lunyu.json',
          size: getFileSize(path.join(dataDir, '论语/lunyu.json')),
          icon: '📖',
          desc: '孔子语录 · 儒家经典',
          children: buildLunyuTree('data/论语/lunyu.json')
        }]
      },
      {
        label: '大学',
        children: [{
          title: '大学全本',
          path: 'data/四书五经/daxue.json',
          size: getFileSize(path.join(dataDir, '四书五经/daxue.json')),
          icon: '📖',
          desc: '儒家经典 · 四书之一',
          children: buildSimpleTree('data/四书五经/daxue.json')
        }]
      },
      {
        label: '中庸',
        children: [{
          title: '中庸全本',
          path: 'data/四书五经/zhongyong.json',
          size: getFileSize(path.join(dataDir, '四书五经/zhongyong.json')),
          icon: '📖',
          desc: '儒家经典 · 四书之一',
          children: buildSimpleTree('data/四书五经/zhongyong.json')
        }]
      },
      {
        label: '孟子',
        children: [{
          title: '孟子全本',
          path: 'data/四书五经/mengzi.json',
          size: getFileSize(path.join(dataDir, '四书五经/mengzi.json')),
          icon: '📖',
          desc: '孟子语录 · 儒家经典',
          children: buildSimpleTree('data/四书五经/mengzi.json')
        }]
      }
    ]
  });

  tree.children.push({
    label: '唐诗',
    children: [
      {
        label: '全唐诗',
        children: [
          {
            title: '全唐诗·诗人',
            path: 'data/全唐诗/authors.tang.json',
            size: getFileSize(path.join(dataDir, '全唐诗/authors.tang.json')),
            icon: '📗',
            desc: `唐代诗人名录 · ${tangPoems.length}首诗`,
            children: buildAuthorTree(tangPoems, tangFileMap)
          }
        ]
      },
      {
        label: '水墨唐诗',
        children: [{
          title: '水墨唐诗',
          path: 'data/水墨唐诗/shuimotangshi.json',
          size: getFileSize(path.join(dataDir, '水墨唐诗/shuimotangshi.json')),
          icon: '🖌️',
          desc: '诗书画卷 · 艺术之美',
          children: buildSimpleTree('data/水墨唐诗/shuimotangshi.json')
        }]
      },
      {
        label: '曹操诗集',
        children: [{
          title: '曹操诗集',
          path: 'data/曹操诗集/caocao.json',
          size: getFileSize(path.join(dataDir, '曹操诗集/caocao.json')),
          icon: '⚔️',
          desc: '曹操 · 建安风骨',
          children: buildSimpleTree('data/曹操诗集/caocao.json')
        }]
      }
    ]
  });

  tree.children.push({
    label: '宋词',
    children: [
      {
        label: '全宋词',
        children: [
          {
            title: '全宋词·词作',
            path: 'data/宋词/ci.song.0.json',
            size: getFileSize(path.join(dataDir, '宋词/ci.song.0.json')),
            icon: '📘',
            desc: `宋代词作精选 · ${songPoems.length}首词`,
            children: buildAuthorTree(songPoems, songFileMap)
          }
        ]
      },
      {
        label: '五代词',
        children: [
          {
            title: '花间集',
            path: 'data/五代诗词/huajianji/huajianji-0-preface.json',
            size: getFileSize(path.join(dataDir, '五代诗词/huajianji/huajianji-0-preface.json')),
            icon: '📕',
            desc: '晚唐五代词',
            children: buildSimpleTree('data/五代诗词/huajianji/huajianji-0-preface.json')
          },
          {
            title: '南唐二主词',
            path: 'data/五代诗词/nantang/poetrys.json',
            size: getFileSize(path.join(dataDir, '五代诗词/nantang/poetrys.json')),
            icon: '📕',
            desc: '李璟李煜词作',
            children: buildSimpleTree('data/五代诗词/nantang/poetrys.json')
          }
        ]
      }
    ]
  });

  tree.children.push({
    label: '元曲',
    children: [
      {
        label: '全元曲',
        children: [{
          title: '全元曲',
          path: 'data/元曲/yuanqu.json',
          size: getFileSize(path.join(dataDir, '元曲/yuanqu.json')),
          icon: '🎭',
          desc: `元代散曲杂剧 · ${yuanPoems.length}首`,
          children: buildAuthorTree(yuanPoems, yuanFileMap)
        }]
      }
    ]
  });

  tree.children.push({
    label: '清代文学',
    children: [
      {
        label: '纳兰性德',
        children: [{
          title: '纳兰性德诗集',
          path: 'data/纳兰性德/纳兰性德诗集.json',
          size: getFileSize(path.join(dataDir, '纳兰性德/纳兰性德诗集.json')),
          icon: '❄️',
          desc: '纳兰性德 · 清代词人',
          children: buildSimpleTree('data/纳兰性德/纳兰性德诗集.json')
        }]
      },
      {
        label: '幽梦影',
        children: [{
          title: '幽梦影',
          path: 'data/幽梦影/youmengying.json',
          size: getFileSize(path.join(dataDir, '幽梦影/youmengying.json')),
          icon: '🌙',
          desc: '张潮 · 清代格言',
          children: buildSimpleTree('data/幽梦影/youmengying.json')
        }]
      }
    ]
  });

  tree.children.push({
    label: '蒙学读物',
    children: [
      {
        label: '三字经',
        children: [{
          title: '三字经',
          path: 'data/蒙学/sanzijing-new.json',
          size: getFileSize(path.join(dataDir, '蒙学/sanzijing-new.json')),
          icon: '📒',
          desc: '传统启蒙读物',
          children: buildSimpleTree('data/蒙学/sanzijing-new.json')
        }]
      },
      {
        label: '百家姓',
        children: [{
          title: '百家姓',
          path: 'data/蒙学/baijiaxing.json',
          size: getFileSize(path.join(dataDir, '蒙学/baijiaxing.json')),
          icon: '📒',
          desc: '传统启蒙读物',
          children: buildSimpleTree('data/蒙学/baijiaxing.json')
        }]
      }
    ]
  });

  const yudingDir = path.join(dataDir, '御定全唐詩', 'json');
  if (fs.existsSync(yudingDir)) {
    const yudingFiles = fs.readdirSync(yudingDir).filter(f => f.endsWith('.json'));
    yudingFiles.sort((a, b) => parseInt(a) - parseInt(b));
    const yudingChildren = yudingFiles.map(file => {
      const num = file.replace('.json', '');
      const filePath = `data/御定全唐詩/json/${file}`;
      const size = getFileSize(path.join(__dirname, filePath));
      return {
        label: `卷${parseInt(num)}`,
        children: [{
          title: `御定全唐诗·卷${parseInt(num)}`,
          path: filePath,
          size: size,
          icon: '👑',
          desc: '康熙御定全唐诗',
          children: buildSimpleTree(filePath)
        }]
      };
    });
    tree.children.push({
      label: '御定全唐诗',
      children: yudingChildren
    });
  }

  return tree;
}

const tree = buildTree();

let totalPoems = 0;

function countItems(node) {
  if (node.type === 'poem') {
    totalPoems++;
    return;
  }
  if (node.children) {
    node.children.forEach(countItems);
  }
}

tree.children.forEach(countItems);

console.log(`Generated tree with ${totalPoems} poems`);

fs.writeFileSync(path.join(__dirname, 'tree.json'), JSON.stringify(tree, null, 2));
console.log('tree.json generated successfully!');

const embeddedTree = `const TREE_DATA = ${JSON.stringify(tree)};`;
fs.writeFileSync(path.join(__dirname, 'tree-data.js'), embeddedTree);
console.log('tree-data.js generated successfully!');