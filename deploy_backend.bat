@echo off
setlocal enabledelayedexpansion
chcp 65001
title 一键部署后端代码脚本 (摘星译)

echo ====================================
echo Git 一键部署后端代码脚本 (摘星译)
echo ====================================
echo.

:: 检查当前目录是否是Git仓库
if not exist ".git" (
    echo 错误：当前目录不是一个Git仓库，请在正确的目录运行此脚本。
    echo.
    goto :end
)

echo.
echo ====================================
echo (1/3) 正在执行本地 Git 操作...
echo ====================================

:: 检查是否有未提交的更改
git diff-index --quiet HEAD --
if errorlevel 1 (
    set /p commit_message="请输入本次提交的描述信息: "
    if "!commit_message!"=="" (
        echo 警告：提交信息不能为空。
        goto :end
    )

    git add .
    if errorlevel 1 (
        echo 错误：git add 失败。
        goto :end
    )

    git commit -m "!commit_message!"
    if errorlevel 1 (
        echo 错误：git commit 失败。
        goto :end
    )

    git push gitee master
    if errorlevel 1 (
        echo 错误：git push 失败，请检查网络连接或仓库配置。
        goto :end
    )
) else (
    echo 没有需要提交的更改，跳过提交和推送步骤。
)

echo.
echo ====================================
echo (2/3) 本地操作完成，开始远程部署...
echo ====================================

ssh root@8.134.192.197 "cd /opt/zhaixingyi-backend && git pull gitee master && pm2 restart zhaixingyi-api"
if errorlevel 1 (
    echo 错误：远程部署失败，请检查SSH连接、Git、PM2状态。
    goto :end
)

echo.
echo ====================================
echo (3/3) 部署成功！
echo ====================================

:end
echo.
pause
